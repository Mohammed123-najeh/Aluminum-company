<?php

namespace App\Http\Controllers;

use App\Models\LeaveRequest;
use App\Models\SalaryIncreaseRequest;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class HrAnalyticsController extends Controller
{
    public function index(Request $request)
    {
        $me = $request->user();
        if (!$me->isHrStaff() && $me->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $now = Carbon::now();
        $monthStart = $now->copy()->startOfMonth();
        $monthEnd = $now->copy()->endOfMonth();
        $yearStart = $now->copy()->startOfYear();

        $pendingLeave = LeaveRequest::where('status', 'pending')
            ->where('workflow_step', 'hr')
            ->count();
        $pendingSalary = SalaryIncreaseRequest::where('status', 'pending')->count();

        $approvedLeaveThisMonth = LeaveRequest::query()
            ->where('status', 'approved')
            ->whereBetween('start_date', [$monthStart->toDateString(), $monthEnd->toDateString()])
            ->count();

        $holidayDaysApprovedThisMonth = (float) LeaveRequest::query()
            ->where('status', 'approved')
            ->where('type', 'holiday')
            ->where(function ($q) use ($monthStart, $monthEnd) {
                $q->whereBetween('start_date', [$monthStart->toDateString(), $monthEnd->toDateString()])
                    ->orWhereBetween('end_date', [$monthStart->toDateString(), $monthEnd->toDateString()]);
            })
            ->sum('days_count');

        $sickDaysApprovedThisMonth = (float) LeaveRequest::query()
            ->where('status', 'approved')
            ->where('type', 'sick')
            ->where(function ($q) use ($monthStart, $monthEnd) {
                $q->whereBetween('start_date', [$monthStart->toDateString(), $monthEnd->toDateString()])
                    ->orWhereBetween('end_date', [$monthStart->toDateString(), $monthEnd->toDateString()]);
            })
            ->sum('days_count');

        $leaveByTypeYear = LeaveRequest::query()
            ->select('type', DB::raw('SUM(days_count) as total_days'), DB::raw('COUNT(*) as cnt'))
            ->where('status', 'approved')
            ->where('start_date', '>=', $yearStart->toDateString())
            ->groupBy('type')
            ->get()
            ->mapWithKeys(fn($r) => [$r->type => ['days' => (float) $r->total_days, 'count' => (int) $r->cnt]]);

        $employeesWithLeave = User::query()
            ->where('role', 'employee')
            ->where('status', 'active')
            ->count();

        $avgSalary = User::query()
            ->whereIn('role', ['employee', 'supervisor'])
            ->whereNotNull('base_salary')
            ->avg('base_salary');

        $recentLeave = LeaveRequest::query()
            ->with('user:id,name')
            ->orderByDesc('created_at')
            ->limit(8)
            ->get()
            ->map(fn($r) => [
                'id' => (string) $r->id,
                'employeeName' => $r->user?->name,
                'type' => $r->type,
                'daysCount' => $r->days_count,
                'status' => $r->status,
                'createdAt' => $r->created_at->toISOString(),
            ]);

        $directory = $this->buildDirectoryRows();

        return response()->json([
            'pendingLeaveRequests'     => $pendingLeave,
            'pendingSalaryRequests'    => $pendingSalary,
            'approvedLeaveCountThisMonth' => $approvedLeaveThisMonth,
            'holidayDaysApprovedThisMonth'=> $holidayDaysApprovedThisMonth,
            'sickDaysApprovedThisMonth'   => $sickDaysApprovedThisMonth,
            'leaveByTypeYear'          => $leaveByTypeYear,
            'activeEmployeesCount'     => $employeesWithLeave,
            'averageBaseSalary'        => $avgSalary !== null ? round((float) $avgSalary, 2) : null,
            'recentLeaveActivity'      => $recentLeave,
            'directory'                => $directory,
        ]);
    }

    /**
     * Full org table for HR dashboard (excludes admin accounts).
     *
     * @return array<int, array<string, mixed>>
     */
    private function buildDirectoryRows(): array
    {
        $users = User::query()
            ->where('role', '!=', 'admin')
            ->with('supervisor:id,name')
            ->orderBy('name')
            ->get();

        if ($users->isEmpty()) {
            return [];
        }

        $ids = $users->pluck('id')->all();
        $yearStart = now()->copy()->startOfYear()->toDateString();

        $ytdByUserType = LeaveRequest::query()
            ->whereIn('user_id', $ids)
            ->where('status', 'approved')
            ->where('start_date', '>=', $yearStart)
            ->select('user_id', 'type')
            ->selectRaw('SUM(days_count) as total_days')
            ->groupBy('user_id', 'type')
            ->get();

        $ytdMap = [];
        foreach ($ytdByUserType as $row) {
            $uid = (string) $row->user_id;
            if (! isset($ytdMap[$uid])) {
                $ytdMap[$uid] = ['holiday' => 0.0, 'sick' => 0.0];
            }
            $ytdMap[$uid][$row->type] = (float) $row->total_days;
        }

        $pendingLeave = LeaveRequest::query()
            ->whereIn('user_id', $ids)
            ->where('status', 'pending')
            ->select('user_id')
            ->selectRaw('COUNT(*) as c')
            ->groupBy('user_id')
            ->pluck('c', 'user_id');

        $pendingSalary = SalaryIncreaseRequest::query()
            ->whereIn('user_id', $ids)
            ->where('status', 'pending')
            ->select('user_id')
            ->selectRaw('COUNT(*) as c')
            ->groupBy('user_id')
            ->pluck('c', 'user_id');

        $out = [];
        foreach ($users as $u) {
            $uid = (string) $u->id;
            $yt = $ytdMap[$uid] ?? ['holiday' => 0.0, 'sick' => 0.0];
            $out[] = [
                'id'                     => $uid,
                'name'                   => $u->name,
                'email'                  => $u->email,
                'role'                   => $u->role,
                'employeeType'           => $u->employee_type,
                'mainJob'                => $u->main_job,
                'status'                 => $u->status,
                'baseSalary'             => $u->base_salary !== null ? (string) $u->base_salary : null,
                'annualLeaveBalance'     => $u->annual_leave_balance !== null ? (string) $u->annual_leave_balance : null,
                'supervisorId'           => $u->supervisor_id ? (string) $u->supervisor_id : null,
                'supervisorName'         => $u->supervisor?->name,
                'approvedHolidayDaysYtd' => $yt['holiday'],
                'approvedSickDaysYtd'    => $yt['sick'],
                'pendingLeaveCount'      => (int) ($pendingLeave[$u->id] ?? 0),
                'pendingSalaryCount'     => (int) ($pendingSalary[$u->id] ?? 0),
            ];
        }

        return $out;
    }

    public function employeeDetail(Request $request, User $user)
    {
        $me = $request->user();
        if (! $me->isHrStaff() && $me->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        if ($user->role === 'admin') {
            return response()->json(['message' => 'Not found'], 404);
        }

        $user->load('supervisor:id,name');

        $leaveRequests = LeaveRequest::query()
            ->where('user_id', $user->id)
            ->with('decidedBy:id,name')
            ->orderByDesc('start_date')
            ->orderByDesc('created_at')
            ->get();

        $salaryRequests = SalaryIncreaseRequest::query()
            ->where('user_id', $user->id)
            ->with('decidedBy:id,name')
            ->orderByDesc('created_at')
            ->get();

        $yearStart = now()->copy()->startOfYear()->toDateString();
        $totals = LeaveRequest::query()
            ->where('user_id', $user->id)
            ->where('status', 'approved')
            ->where('start_date', '>=', $yearStart)
            ->select('type')
            ->selectRaw('SUM(days_count) as total_days')
            ->groupBy('type')
            ->get()
            ->mapWithKeys(fn($r) => [$r->type => (float) $r->total_days]);

        $allTimeLeave = LeaveRequest::query()
            ->where('user_id', $user->id)
            ->where('status', 'approved')
            ->select('type')
            ->selectRaw('SUM(days_count) as total_days')
            ->groupBy('type')
            ->get()
            ->mapWithKeys(fn($r) => [$r->type => (float) $r->total_days]);

        $profile = $user->toApiArray();
        $profile['supervisorName'] = $user->supervisor?->name;

        return response()->json([
            'user' => $profile,
            'leaveRequests' => $leaveRequests->map(fn($r) => $r->toApiArray())->values()->all(),
            'salaryRequests' => $salaryRequests->map(fn($r) => $r->toApiArray())->values()->all(),
            'approvedLeaveDaysYtd' => [
                'holiday' => (float) ($totals['holiday'] ?? 0),
                'sick'    => (float) ($totals['sick'] ?? 0),
            ],
            'approvedLeaveDaysAllTime' => [
                'holiday' => (float) ($allTimeLeave['holiday'] ?? 0),
                'sick'    => (float) ($allTimeLeave['sick'] ?? 0),
            ],
        ]);
    }
}
