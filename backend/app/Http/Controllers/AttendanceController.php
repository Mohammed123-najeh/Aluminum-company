<?php

namespace App\Http\Controllers;

use App\Models\AttendanceLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    /**
     * GET /attendance
     * Query params:
     *   user_id    – filter (admin only)
     *   from, to   – date range YYYY-MM-DD (defaults: current month)
     *
     * Returns flat list of attendance log rows (most recent first).
     */
    public function index(Request $request)
    {
        $me = $request->user();
        [$from, $to] = $this->dateRange($request);

        $query = AttendanceLog::query()
            ->whereBetween('clock_in_at', [$from, $to])
            ->orderByDesc('clock_in_at')
            ->with('user:id,name,role,supervisor_id');

        $this->scopeForViewer($query, $me, $request->query('user_id'));

        $logs = $query->limit(500)->get();

        return response()->json($logs->map(fn ($l) => array_merge($l->toApiArray(), [
            'userName' => $l->user?->name,
        ])));
    }

    /**
     * GET /attendance/summary
     * Aggregated hours + computed pay per user across a date range.
     */
    public function summary(Request $request)
    {
        $me = $request->user();
        [$from, $to] = $this->dateRange($request);

        $userQuery = User::query()->where('role', '!=', 'admin');
        if ($me->role === 'supervisor') {
            $userQuery->where(function ($q) use ($me) {
                $q->where('supervisor_id', $me->id)->orWhere('id', $me->id);
            });
        } elseif ($me->role === 'employee') {
            // Plain employees (and HR/accountant/sales staff) only see their own row.
            $userQuery->where('id', $me->id);
        }

        $users = $userQuery->get(['id', 'name', 'role', 'employee_type', 'hourly_rate', 'supervisor_id']);

        // Pull all logs in range for these users in one query.
        $logs = AttendanceLog::query()
            ->whereIn('user_id', $users->pluck('id'))
            ->whereBetween('clock_in_at', [$from, $to])
            ->get(['user_id', 'clock_in_at', 'clock_out_at', 'minutes_worked']);

        $byUser = $logs->groupBy('user_id');

        $rows = $users->map(function (User $u) use ($byUser) {
            $entries = $byUser->get($u->id, collect());
            $totalMinutes = (int) $entries->sum(function ($l) {
                if ($l->minutes_worked !== null) {
                    return $l->minutes_worked;
                }
                if ($l->clock_in_at && $l->clock_out_at) {
                    return max(0, $l->clock_in_at->diffInMinutes($l->clock_out_at));
                }

                return 0;
            });
            $totalHours = round($totalMinutes / 60, 2);
            $rate = $u->hourly_rate !== null ? (float) $u->hourly_rate : null;
            $earned = $rate !== null ? round($totalHours * $rate, 2) : null;
            $sessions = $entries->count();
            $lastSession = $entries->sortByDesc('clock_in_at')->first();

            return [
                'userId' => (string) $u->id,
                'userName' => $u->name,
                'role' => $u->role,
                'employeeType' => $u->employee_type,
                'supervisorId' => $u->supervisor_id ? (string) $u->supervisor_id : null,
                'hourlyRate' => $rate,
                'totalMinutes' => $totalMinutes,
                'totalHours' => $totalHours,
                'computedEarnings' => $earned,
                'sessionsCount' => $sessions,
                'lastClockInAt' => optional($lastSession)->clock_in_at?->toIso8601String(),
                'lastClockOutAt' => optional($lastSession)->clock_out_at?->toIso8601String(),
            ];
        })->values();

        return response()->json([
            'from' => $from->toIso8601String(),
            'to' => $to->toIso8601String(),
            'rows' => $rows,
        ]);
    }

    private function scopeForViewer($query, User $me, ?string $userIdParam): void
    {
        if ($me->role === 'admin') {
            if ($userIdParam) {
                $query->where('user_id', (int) $userIdParam);
            }

            return;
        }

        if ($me->role === 'supervisor') {
            $teamIds = User::where('supervisor_id', $me->id)->pluck('id')->push($me->id);
            $query->whereIn('user_id', $teamIds);
            if ($userIdParam && $teamIds->contains((int) $userIdParam)) {
                $query->where('user_id', (int) $userIdParam);
            }

            return;
        }

        // Employees: only their own logs.
        $query->where('user_id', $me->id);
    }

    /**
     * @return array{0: \Carbon\CarbonInterface, 1: \Carbon\CarbonInterface}
     */
    private function dateRange(Request $request): array
    {
        $fromRaw = (string) $request->query('from', '');
        $toRaw = (string) $request->query('to', '');

        try {
            $from = $fromRaw !== '' ? Carbon::parse($fromRaw)->startOfDay() : Carbon::now()->startOfMonth();
        } catch (\Throwable $e) {
            $from = Carbon::now()->startOfMonth();
        }
        try {
            $to = $toRaw !== '' ? Carbon::parse($toRaw)->endOfDay() : Carbon::now()->endOfDay();
        } catch (\Throwable $e) {
            $to = Carbon::now()->endOfDay();
        }

        if ($from->greaterThan($to)) {
            [$from, $to] = [$to, $from];
        }

        return [$from, $to];
    }
}
