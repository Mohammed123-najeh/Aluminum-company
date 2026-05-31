<?php

namespace App\Http\Controllers;

use App\Models\AttendanceLog;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Activity-based attendance tracking.
 *
 * The frontend pings POST /attendance/heartbeat every ~30 seconds while the
 * user is active. We stitch consecutive heartbeats into an attendance session
 * and close it when the gap between heartbeats exceeds GAP_THRESHOLD_SECONDS
 * (typically because the user went idle for 10+ minutes and the client
 * stopped sending pings, or because they closed the tab).
 *
 * This replaces the old "open a session on login / close on logout" model,
 * which would over-count time when employees stayed logged in but inactive,
 * and double-count when they logged in from multiple tabs.
 */
class AttendanceHeartbeatController extends Controller
{
    /**
     * Stitching threshold: two heartbeats within this window count as one
     * continuous session. Picked larger than the client's ping interval (30s)
     * with margin for network jitter, but smaller than the idle threshold
     * (10 min) so a deliberate pause closes the session.
     */
    private const GAP_THRESHOLD_SECONDS = 90;

    public function ping(Request $request)
    {
        $user = $request->user();
        $now = Carbon::now();

        // Wrap in a transaction with row-level locking so two simultaneous
        // heartbeats from a duplicated tab can't both create new sessions.
        return DB::transaction(function () use ($user, $now, $request) {
            $open = AttendanceLog::query()
                ->where('user_id', $user->id)
                ->whereNull('clock_out_at')
                ->orderByDesc('clock_in_at')
                ->lockForUpdate()
                ->first();

            // Defensive cleanup: if multiple open sessions exist (legacy data,
            // race that slipped through), close every one except the newest.
            $extraOpens = AttendanceLog::query()
                ->where('user_id', $user->id)
                ->whereNull('clock_out_at')
                ->when($open, fn ($q) => $q->where('id', '!=', $open->id))
                ->lockForUpdate()
                ->get();
            foreach ($extraOpens as $stale) {
                $closeAt = $stale->last_heartbeat_at ?? $stale->clock_in_at;
                $stale->clock_out_at = $closeAt;
                $stale->minutes_worked = max(0, (int) $stale->clock_in_at->diffInMinutes($closeAt));
                $stale->save();
            }

            if ($open) {
                $lastTick = $open->last_heartbeat_at ?? $open->clock_in_at;
                $gapSeconds = $lastTick ? (int) $lastTick->diffInSeconds($now) : self::GAP_THRESHOLD_SECONDS + 1;

                if ($gapSeconds <= self::GAP_THRESHOLD_SECONDS) {
                    // Continue the same session. Bump the heartbeat and recompute
                    // minutes from clock_in_at so partial-minute increments roll up.
                    $open->last_heartbeat_at = $now;
                    $open->minutes_worked = max(0, (int) $open->clock_in_at->diffInMinutes($now));
                    $open->save();

                    return response()->json([
                        'sessionId' => (string) $open->id,
                        'sessionStartedAt' => $open->clock_in_at->toIso8601String(),
                        'minutesInSession' => $open->minutes_worked,
                        'continued' => true,
                    ]);
                }

                // Gap too large — close the previous session at its last known
                // heartbeat (not now, otherwise idle time would be counted).
                $open->clock_out_at = $open->last_heartbeat_at ?? $open->clock_in_at;
                $open->minutes_worked = max(0, (int) $open->clock_in_at->diffInMinutes($open->clock_out_at));
                $open->save();
            }

            // Open a fresh session anchored at `now`.
            $fresh = AttendanceLog::create([
                'user_id' => $user->id,
                'clock_in_at' => $now,
                'last_heartbeat_at' => $now,
                'minutes_worked' => 0,
                'ip_address' => $request->ip(),
                'user_agent' => substr((string) $request->userAgent(), 0, 255),
            ]);

            return response()->json([
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
     *
     * Sessions that span midnight (e.g. clocked in at 23:30 yesterday, still
     * active at 00:30 today) are clipped to today's boundaries so the timer
     * always shows "work done today" and resets cleanly at midnight.
     */
    public function today(Request $request)
    {
        $user = $request->user();
        $now = Carbon::now();
        $dayStart = $now->copy()->startOfDay();
        $dayEnd = $now->copy()->endOfDay();

        // Pull any session that overlaps today: clock_in is today, OR clock_in
        // was earlier but it is still open / closed after midnight.
        $logs = AttendanceLog::query()
            ->where('user_id', $user->id)
            ->where(function ($q) use ($dayStart, $dayEnd) {
                $q->whereBetween('clock_in_at', [$dayStart, $dayEnd])
                  ->orWhere(function ($qq) use ($dayStart) {
                      $qq->where('clock_in_at', '<', $dayStart)
                         ->where(function ($qqq) use ($dayStart) {
                             $qqq->whereNull('clock_out_at')
                                 ->orWhere('clock_out_at', '>=', $dayStart);
                         });
                  });
            })
            ->get();

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
            // Count only as far as the last heartbeat so idle time doesn't sneak in.
            $effectiveEnd = ($openSession->last_heartbeat_at ?? $openSession->clock_in_at)->copy()->min($dayEnd);
            $effectiveStart = $openSession->clock_in_at->copy()->max($dayStart);
            if ($effectiveEnd->gt($effectiveStart)) {
                $openMinutes = (int) $effectiveStart->diffInMinutes($effectiveEnd);
            }
        }

        return response()->json([
            'date' => $dayStart->toDateString(),
            'minutesWorked' => $closedMinutes + $openMinutes,
            'openSession' => $openSession ? [
                'id' => (string) $openSession->id,
                'startedAt' => $openSession->clock_in_at->toIso8601String(),
                'lastHeartbeatAt' => $openSession->last_heartbeat_at?->toIso8601String(),
                'minutesInSession' => $openMinutes,
            ] : null,
        ]);
    }
}
