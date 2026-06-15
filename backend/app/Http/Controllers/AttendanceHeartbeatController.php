<?php

namespace App\Http\Controllers;

use App\Models\AttendanceLog;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Explicit work-session tracking.
 *
 * The frontend opens a session only after the user confirms "start work", then
 * pings POST /attendance/heartbeat every ~30 seconds while that session is
 * running. Consecutive heartbeats are stitched into one attendance row.
 */
class AttendanceHeartbeatController extends Controller
{
    private const GAP_THRESHOLD_SECONDS = 90;
    private const WORKDAY_LIMIT_MINUTES = 8 * 60;

    private function closeLog(AttendanceLog $log, Carbon $closeAt): void
    {
        $limitAt = $log->clock_in_at->copy()->addMinutes(self::WORKDAY_LIMIT_MINUTES);
        $effectiveClose = $closeAt->copy()->min($limitAt);

        if ($effectiveClose->lt($log->clock_in_at)) {
            $effectiveClose = $log->clock_in_at->copy();
        }

        $log->clock_out_at = $effectiveClose;
        $log->last_heartbeat_at = $log->last_heartbeat_at ?? $effectiveClose;
        $log->minutes_worked = min(
            self::WORKDAY_LIMIT_MINUTES,
            max(0, (int) $log->clock_in_at->diffInMinutes($effectiveClose))
        );
        $log->save();
    }

    private function queryLogsForDay(int $userId, Carbon $dayStart, Carbon $dayEnd)
    {
        return AttendanceLog::query()
            ->where('user_id', $userId)
            ->where(function ($q) use ($dayStart, $dayEnd) {
                $q->whereBetween('clock_in_at', [$dayStart, $dayEnd])
                    ->orWhere(function ($qq) use ($dayStart) {
                        $qq->where('clock_in_at', '<', $dayStart)
                            ->where(function ($qqq) use ($dayStart) {
                                $qqq->whereNull('clock_out_at')
                                    ->orWhere('clock_out_at', '>=', $dayStart);
                            });
                    });
            });
    }

    private function minutesWorkedForDay(int $userId, Carbon $dayStart, Carbon $dayEnd): int
    {
        $minutes = 0;

        foreach ($this->queryLogsForDay($userId, $dayStart, $dayEnd)->get() as $log) {
            $start = $log->clock_in_at->copy()->max($dayStart);
            $end = ($log->clock_out_at ?? $log->last_heartbeat_at ?? $log->clock_in_at)->copy()->min($dayEnd);

            if ($end->gt($start)) {
                $minutes += (int) $start->diffInMinutes($end);
            }
        }

        return min(self::WORKDAY_LIMIT_MINUTES, $minutes);
    }

    private function inactiveResponse(Carbon $now, int $minutesWorked)
    {
        return response()->json([
            'date' => $now->toDateString(),
            'active' => false,
            'workdayLimitMinutes' => self::WORKDAY_LIMIT_MINUTES,
            'minutesWorked' => min(self::WORKDAY_LIMIT_MINUTES, $minutesWorked),
            'openSession' => null,
        ]);
    }

    public function ping(Request $request)
    {
        $user = $request->user();
        $now = Carbon::now();
        $raw = $request->input('intent');
        $intent = in_array($raw, ['start', 'stop'], true) ? $raw : 'heartbeat';

        return DB::transaction(function () use ($user, $now, $request, $intent) {
            $open = AttendanceLog::query()
                ->where('user_id', $user->id)
                ->whereNull('clock_out_at')
                ->orderByDesc('clock_in_at')
                ->lockForUpdate()
                ->first();

            $extraOpens = AttendanceLog::query()
                ->where('user_id', $user->id)
                ->whereNull('clock_out_at')
                ->when($open, fn ($q) => $q->where('id', '!=', $open->id))
                ->lockForUpdate()
                ->get();

            foreach ($extraOpens as $stale) {
                $this->closeLog($stale, $stale->last_heartbeat_at ?? $stale->clock_in_at);
            }

            // Explicit "End work": close the open session now (saving the minutes
            // worked so far) and report inactive. Logging in/out no longer touches
            // the clock — only Start/End work does.
            if ($intent === 'stop') {
                if ($open) {
                    $this->closeLog($open, $now);
                }
                $dayStart = $now->copy()->startOfDay();
                $dayEnd = $now->copy()->endOfDay();

                return $this->inactiveResponse($now, $this->minutesWorkedForDay($user->id, $dayStart, $dayEnd));
            }

            if ($open) {
                $lastTick = $open->last_heartbeat_at ?? $open->clock_in_at;
                $gapSeconds = $lastTick ? (int) $lastTick->diffInSeconds($now) : self::GAP_THRESHOLD_SECONDS + 1;
                $limitAt = $open->clock_in_at->copy()->addMinutes(self::WORKDAY_LIMIT_MINUTES);
                $startedBeforeToday = $open->clock_in_at->lt($now->copy()->startOfDay());

                if ($startedBeforeToday || $now->gte($limitAt)) {
                    $this->closeLog($open, $now->gte($limitAt) ? $limitAt : $lastTick);
                    $open = null;
                } elseif ($gapSeconds <= self::GAP_THRESHOLD_SECONDS) {
                    $open->last_heartbeat_at = $now;
                    $open->minutes_worked = min(
                        self::WORKDAY_LIMIT_MINUTES,
                        max(0, (int) $open->clock_in_at->diffInMinutes($now))
                    );
                    $open->save();

                    return response()->json([
                        'active' => true,
                        'workdayLimitMinutes' => self::WORKDAY_LIMIT_MINUTES,
                        'sessionId' => (string) $open->id,
                        'sessionStartedAt' => $open->clock_in_at->toIso8601String(),
                        'minutesInSession' => $open->minutes_worked,
                        'continued' => true,
                    ]);
                } else {
                    $this->closeLog($open, $lastTick);
                    $open = null;
                }
            }

            $dayStart = $now->copy()->startOfDay();
            $dayEnd = $now->copy()->endOfDay();
            $minutesWorked = $this->minutesWorkedForDay($user->id, $dayStart, $dayEnd);

            if ($intent !== 'start' || $minutesWorked >= self::WORKDAY_LIMIT_MINUTES) {
                return $this->inactiveResponse($now, $minutesWorked);
            }

            $fresh = AttendanceLog::create([
                'user_id' => $user->id,
                'clock_in_at' => $now,
                'last_heartbeat_at' => $now,
                'minutes_worked' => 0,
                'ip_address' => $request->ip(),
                'user_agent' => substr((string) $request->userAgent(), 0, 255),
            ]);

            return response()->json([
                'active' => true,
                'workdayLimitMinutes' => self::WORKDAY_LIMIT_MINUTES,
                'sessionId' => (string) $fresh->id,
                'sessionStartedAt' => $fresh->clock_in_at->toIso8601String(),
                'minutesInSession' => 0,
                'continued' => false,
            ]);
        });
    }

    /**
     * Quick summary for the top-bar timer: today's total worked minutes
     * (closed + open sessions) and whether a session is currently open.
     */
    public function today(Request $request)
    {
        $user = $request->user();
        $now = Carbon::now();
        $dayStart = $now->copy()->startOfDay();
        $dayEnd = $now->copy()->endOfDay();

        AttendanceLog::query()
            ->where('user_id', $user->id)
            ->whereNull('clock_out_at')
            ->orderByDesc('clock_in_at')
            ->get()
            ->each(function (AttendanceLog $log) use ($now) {
                $lastTick = $log->last_heartbeat_at ?? $log->clock_in_at;
                $gapSeconds = $lastTick ? (int) $lastTick->diffInSeconds($now) : self::GAP_THRESHOLD_SECONDS + 1;
                $limitAt = $log->clock_in_at->copy()->addMinutes(self::WORKDAY_LIMIT_MINUTES);

                if ($log->clock_in_at->lt($now->copy()->startOfDay()) || $now->gte($limitAt) || $gapSeconds > self::GAP_THRESHOLD_SECONDS) {
                    $this->closeLog($log, $now->gte($limitAt) ? $limitAt : $lastTick);
                }
            });

        $logs = $this->queryLogsForDay($user->id, $dayStart, $dayEnd)->get();

        $closedMinutes = 0;
        $openSession = null;
        foreach ($logs as $log) {
            $start = $log->clock_in_at->copy()->max($dayStart);
            if ($log->clock_out_at) {
                $end = $log->clock_out_at->copy()->min($dayEnd);
                if ($end->gt($start)) {
                    $closedMinutes += (int) $start->diffInMinutes($end);
                }
            } elseif ($openSession === null) {
                $openSession = $log;
            }
        }

        $openMinutes = 0;
        if ($openSession) {
            $effectiveEnd = ($openSession->last_heartbeat_at ?? $openSession->clock_in_at)->copy()->min($dayEnd);
            $effectiveStart = $openSession->clock_in_at->copy()->max($dayStart);
            if ($effectiveEnd->gt($effectiveStart)) {
                $openMinutes = (int) $effectiveStart->diffInMinutes($effectiveEnd);
            }
        }

        $minutesWorked = min(self::WORKDAY_LIMIT_MINUTES, $closedMinutes + $openMinutes);

        return response()->json([
            'date' => $dayStart->toDateString(),
            'workdayLimitMinutes' => self::WORKDAY_LIMIT_MINUTES,
            'minutesWorked' => $minutesWorked,
            'openSession' => $openSession ? [
                'id' => (string) $openSession->id,
                'startedAt' => $openSession->clock_in_at->toIso8601String(),
                'lastHeartbeatAt' => $openSession->last_heartbeat_at?->toIso8601String(),
                'minutesInSession' => $openMinutes,
            ] : null,
        ]);
    }
}
