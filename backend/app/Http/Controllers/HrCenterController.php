<?php

namespace App\Http\Controllers;

use App\Models\AttendanceLog;
use App\Models\EmployeeDocument;
use App\Models\LeaveRequest;
use App\Models\PayrollRun;
use App\Models\Payslip;
use App\Models\PublicHoliday;
use App\Models\SalaryIncrement;
use App\Models\User;
use App\Models\WorkScheduleSetting;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class HrCenterController extends Controller
{
    private function gate(Request $request): ?\Illuminate\Http\JsonResponse
    {
        $user = $request->user();
        if (! $user || ! ($user->role === 'admin' || $user->isHrStaff())) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        return null;
    }

    // ===== Dashboard =====

    public function dashboard(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $today = Carbon::today();
        $weekStart = Carbon::today()->subDays(6);

        $totalEmployees = User::where('role', '!=', 'admin')->where('status', 'active')->count();

        $presentToday = AttendanceLog::whereDate('clock_in_at', $today)
            ->where('status', '!=', 'absent')->distinct('user_id')->count('user_id');
        $absentToday = max(0, $totalEmployees - $presentToday);
        $lateToday = AttendanceLog::whereDate('clock_in_at', $today)->where('status', 'late')->count();
        $pendingLeave = LeaveRequest::where('status', 'pending')->count();

        // Work hours logged today (sum of minutes_worked → hours)
        $minutesToday = (int) AttendanceLog::whereDate('clock_in_at', $today)->sum('minutes_worked');
        $workHoursToday = round($minutesToday / 60, 1);

        // Payroll totals = sum(hours_worked × hourly_rate) + allowances.
        // "Today" = sum of today's logged hours × rate. "Month" = same across the current month.
        $monthStart = Carbon::now()->startOfMonth();
        $monthEnd = Carbon::now()->endOfMonth();
        $activeStaff = User::where('role', '!=', 'admin')->where('status', 'active')->get(['id', 'hourly_rate', 'allowances']);
        $monthlyPayroll = 0.0;
        $dailyPayroll = 0.0;
        foreach ($activeStaff as $u) {
            $rate = (float) ($u->hourly_rate ?? 0);
            if ($rate > 0) {
                $minMonth = (int) AttendanceLog::where('user_id', $u->id)
                    ->whereBetween('clock_in_at', [$monthStart, $monthEnd])->sum('minutes_worked');
                $minToday = (int) AttendanceLog::where('user_id', $u->id)
                    ->whereDate('clock_in_at', $today)->sum('minutes_worked');
                $monthlyPayroll += round(($minMonth / 60) * $rate, 2);
                $dailyPayroll += round(($minToday / 60) * $rate, 2);
            }
            foreach (($u->allowances ?? []) as $v) {
                $monthlyPayroll += (float) $v;
            }
        }
        $monthlyPayroll = round($monthlyPayroll, 2);
        $dailyPayroll = round($dailyPayroll, 2);

        // Weekly attendance line
        $weekly = [];
        for ($d = 6; $d >= 0; $d--) {
            $day = Carbon::today()->subDays($d);
            $present = AttendanceLog::whereDate('clock_in_at', $day)->where('status', '!=', 'absent')->distinct('user_id')->count('user_id');
            $late = AttendanceLog::whereDate('clock_in_at', $day)->where('status', 'late')->count();
            $weekly[] = [
                'date' => $day->toDateString(),
                'present' => $present,
                'late' => $late,
                'absent' => max(0, $totalEmployees - $present),
            ];
        }

        // Dept distribution
        $byDept = User::where('role', '!=', 'admin')
            ->where('status', 'active')
            ->selectRaw('COALESCE(department, employee_type, "—") as label, COUNT(*) as count')
            ->groupBy('label')->get()
            ->map(fn ($r) => ['label' => $r->label, 'count' => (int) $r->count]);

        // Live attendance top 10
        $live = AttendanceLog::with('user:id,name,department,employee_type')
            ->whereDate('clock_in_at', $today)
            ->orderByDesc('clock_in_at')->limit(10)->get()
            ->map(fn ($a) => [
                'id' => (string) $a->id,
                'userId' => (string) $a->user_id,
                'userName' => $a->user?->name,
                'department' => $a->user?->department ?? $a->user?->employee_type,
                'clockInAt' => $a->clock_in_at?->toIso8601String(),
                'clockOutAt' => $a->clock_out_at?->toIso8601String(),
                'status' => $a->status,
                'lateMinutes' => (int) ($a->late_minutes ?? 0),
            ]);

        return response()->json([
            'kpi' => [
                'totalEmployees' => $totalEmployees,
                'presentToday' => $presentToday,
                'absentToday' => $absentToday,
                'lateToday' => $lateToday,
                'pendingLeave' => $pendingLeave,
                'pendingLeaveRequests' => $pendingLeave,
                'workHoursToday' => $workHoursToday,
                'monthlyPayroll' => $monthlyPayroll,
                'dailyPayroll' => $dailyPayroll,
            ],
            'weekly' => $weekly,
            'byDepartment' => $byDept,
            'liveAttendance' => $live,
        ]);
    }

    // ===== Employees =====

    public function listEmployees(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $q = User::where('role', '!=', 'admin')->orderBy('name');
        if ($status = $request->query('status')) $q->where('status', $status);
        if ($dept = $request->query('department')) $q->where('department', $dept);
        if ($search = $request->query('q')) {
            $needle = '%' . $search . '%';
            $q->where(fn ($w) => $w->where('name', 'like', $needle)->orWhere('email', 'like', $needle)
                ->orWhere('employee_number', 'like', $needle)->orWhere('phone', 'like', $needle));
        }
        return response()->json($q->limit(500)->get()->map->toApiArray());
    }

    public function showEmployee(Request $request, $id)
    {
        if ($r = $this->gate($request)) return $r;
        $u = User::with('documents', 'salaryIncrements')->findOrFail($id);

        $payslips = Payslip::where('user_id', $id)->with('run')->orderByDesc('id')->limit(24)->get()
            ->map(fn ($p) => $p->toApiArray());

        $leaveHistory = LeaveRequest::where('user_id', $id)->orderByDesc('created_at')->limit(50)->get()
            ->map(fn ($l) => $l->toApiArray());

        $recentAttendance = AttendanceLog::where('user_id', $id)->orderByDesc('clock_in_at')->limit(30)->get()
            ->map(fn ($a) => $a->toApiArray());

        $documents = $u->documents->map(fn ($d) => $d->toApiArray());
        $increments = $u->salaryIncrements->map(fn ($i) => $i->toApiArray());

        return response()->json([
            'user' => $u->toApiArray(),
            'payslips' => $payslips,
            'leaveHistory' => $leaveHistory,
            'recentAttendance' => $recentAttendance,
            'documents' => $documents,
            'increments' => $increments,
        ]);
    }

    public function storeEmployee(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'role' => 'required|in:supervisor,employee',
            'employee_type' => 'nullable|string|max:30',
            'main_job' => 'nullable|string|max:255',
            'department' => 'nullable|string|max:80',
            'employee_number' => 'nullable|string|max:30|unique:users,employee_number',
            'hourly_rate' => 'nullable|numeric|min:0',
            'allowances' => 'nullable|array',
            'national_id' => 'nullable|string|max:40',
            'nationality' => 'nullable|string|max:60',
            'birth_date' => 'nullable|date',
            'gender' => 'nullable|in:male,female',
            'marital_status' => 'nullable|string|max:20',
            'children_count' => 'nullable|integer|min:0',
            'address' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:40',
            'hire_date' => 'nullable|date',
            'contract_type' => 'nullable|string|max:20',
            'contract_duration' => 'nullable|string|max:40',
            'bank_account' => 'nullable|string|max:60',
            'supervisor_id' => 'nullable|exists:users,id',
            'annual_leave_balance' => 'nullable|numeric|min:0',
        ]);
        $data['password'] = Hash::make($data['password']);
        $data['status'] = 'active';
        $u = User::create($data);
        return response()->json($u->toApiArray(), 201);
    }

    public function updateEmployee(Request $request, $id)
    {
        if ($r = $this->gate($request)) return $r;
        $u = User::findOrFail($id);
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => "sometimes|email|unique:users,email,$id",
            'employee_type' => 'nullable|string|max:30',
            'main_job' => 'nullable|string|max:255',
            'department' => 'nullable|string|max:80',
            'employee_number' => "nullable|string|max:30|unique:users,employee_number,$id",
            'hourly_rate' => 'nullable|numeric|min:0',
            'allowances' => 'nullable|array',
            'national_id' => 'nullable|string|max:40',
            'nationality' => 'nullable|string|max:60',
            'birth_date' => 'nullable|date',
            'gender' => 'nullable|in:male,female',
            'marital_status' => 'nullable|string|max:20',
            'children_count' => 'nullable|integer|min:0',
            'address' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:40',
            'hire_date' => 'nullable|date',
            'contract_type' => 'nullable|string|max:20',
            'contract_duration' => 'nullable|string|max:40',
            'bank_account' => 'nullable|string|max:60',
            'supervisor_id' => 'nullable|exists:users,id',
            'annual_leave_balance' => 'nullable|numeric|min:0',
            'status' => 'nullable|in:active,suspended',
        ]);
        $u->update($data);
        return response()->json($u->fresh()->toApiArray());
    }

    // ===== Employee documents =====

    public function listDocuments(Request $request, $userId)
    {
        if ($r = $this->gate($request)) return $r;
        return response()->json(EmployeeDocument::where('user_id', $userId)->orderByDesc('id')->get()->map->toApiArray());
    }

    public function storeDocument(Request $request, $userId)
    {
        if ($r = $this->gate($request)) return $r;
        $data = $request->validate([
            'type' => 'required|string|max:30',
            'label' => 'required|string|max:255',
            'file_path' => 'required|string',
        ]);
        $data['user_id'] = $userId;
        $data['uploaded_by'] = $request->user()->id;
        $d = EmployeeDocument::create($data);
        return response()->json($d->toApiArray(), 201);
    }

    public function deleteDocument(Request $request, $id)
    {
        if ($r = $this->gate($request)) return $r;
        EmployeeDocument::findOrFail($id)->delete();
        return response()->json(['message' => 'deleted']);
    }

    // ===== Attendance =====

    public function attendanceDaily(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $date = $request->query('date', Carbon::today()->toDateString());
        $logs = AttendanceLog::with('user:id,name,department,employee_type,photo_path')
            ->whereDate('clock_in_at', $date)->orderBy('clock_in_at')->get()
            ->map(fn ($a) => array_merge($a->toApiArray(), [
                'userName' => $a->user?->name,
                'department' => $a->user?->department ?? $a->user?->employee_type,
            ]));
        return response()->json(['date' => $date, 'logs' => $logs]);
    }

    public function attendanceMonthly(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $year = (int) $request->query('year', date('Y'));
        $month = (int) $request->query('month', date('n'));
        $start = Carbon::create($year, $month, 1)->startOfMonth();
        $end = $start->copy()->endOfMonth();
        $daysInMonth = $end->day;

        $users = User::where('role', '!=', 'admin')->where('status', 'active')->orderBy('name')->get();
        $userIds = $users->pluck('id')->all();

        $logs = AttendanceLog::whereIn('user_id', $userIds)
            ->whereBetween('clock_in_at', [$start, $end])
            ->get()
            ->groupBy(function ($l) {
                return $l->user_id . '|' . $l->clock_in_at->day;
            });

        $rows = $users->map(function ($u) use ($logs, $daysInMonth) {
            $days = [];
            $presentCount = 0; $absentCount = 0; $lateCount = 0; $leaveDays = 0;
            for ($d = 1; $d <= $daysInMonth; $d++) {
                $key = $u->id . '|' . $d;
                $cell = $logs->get($key);
                if ($cell && $cell->count() > 0) {
                    $first = $cell->first();
                    $days[$d] = $first->status;
                    if ($first->status === 'present') $presentCount++;
                    if ($first->status === 'late') { $lateCount++; $presentCount++; }
                    if ($first->status === 'leave') $leaveDays++;
                } else {
                    $days[$d] = null;
                }
            }
            return [
                'userId' => (string) $u->id,
                'name' => $u->name,
                'department' => $u->department ?? $u->employee_type,
                'days' => $days,
                'totals' => [
                    'present' => $presentCount,
                    'absent' => $absentCount,
                    'late' => $lateCount,
                    'leave' => $leaveDays,
                ],
            ];
        });

        return response()->json([
            'year' => $year,
            'month' => $month,
            'daysInMonth' => $daysInMonth,
            'rows' => $rows,
        ]);
    }

    public function attendanceManual(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'clock_in_at' => 'required|date',
            'clock_out_at' => 'nullable|date',
            'status' => 'required|in:present,late,absent,leave,mission,holiday',
            'late_minutes' => 'nullable|integer|min:0',
            'notes' => 'nullable|string',
        ]);
        $minutes = null;
        if (!empty($data['clock_out_at'])) {
            $minutes = Carbon::parse($data['clock_in_at'])->diffInMinutes(Carbon::parse($data['clock_out_at']));
        }
        $log = AttendanceLog::create(array_merge($data, [
            'minutes_worked' => $minutes,
            'late_minutes' => $data['late_minutes'] ?? 0,
        ]));
        return response()->json($log->toApiArray(), 201);
    }

    public function attendanceUpdate(Request $request, $id)
    {
        if ($r = $this->gate($request)) return $r;
        $log = AttendanceLog::findOrFail($id);
        $log->update($request->only(['clock_in_at', 'clock_out_at', 'status', 'late_minutes', 'notes']));
        return response()->json($log->fresh()->toApiArray());
    }

    public function justifyAttendance(Request $request, $id)
    {
        if ($r = $this->gate($request)) return $r;
        $data = $request->validate([
            'justified' => 'required|boolean',
            'justification_reason' => 'nullable|string',
            'excuse_document_path' => 'nullable|string',
        ]);
        $log = AttendanceLog::findOrFail($id);
        $log->justified = $data['justified'];
        $log->justification_reason = $data['justification_reason'] ?? null;
        $log->excuse_document_path = $data['excuse_document_path'] ?? null;
        $log->decided_by = $request->user()->id;
        $log->decided_at = now();
        $log->save();
        return response()->json($log->fresh()->toApiArray());
    }

    // ===== Public holidays =====

    public function listHolidays(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        return response()->json(PublicHoliday::orderBy('date')->get()->map->toApiArray());
    }

    public function storeHoliday(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $data = $request->validate([
            'date' => 'required|date|unique:public_holidays,date',
            'name_ar' => 'required|string|max:255',
            'name_en' => 'required|string|max:255',
        ]);
        $h = PublicHoliday::create($data);
        return response()->json($h->toApiArray(), 201);
    }

    public function deleteHoliday(Request $request, $id)
    {
        if ($r = $this->gate($request)) return $r;
        PublicHoliday::findOrFail($id)->delete();
        return response()->json(['message' => 'deleted']);
    }

    // ===== Payroll =====

    public function listPayrollRuns(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        return response()->json(PayrollRun::orderByDesc('year')->orderByDesc('month')->get()->map->toApiArray());
    }

    public function computePayrollRun(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $data = $request->validate([
            'year' => 'required|integer|min:2020|max:2100',
            'month' => 'required|integer|min:1|max:12',
        ]);

        return DB::transaction(function () use ($data, $request) {
            $existing = PayrollRun::where('year', $data['year'])->where('month', $data['month'])->first();
            if ($existing && $existing->isLocked()) {
                return response()->json(['message' => 'Payroll already approved for this period'], 422);
            }
            $run = $existing ?? PayrollRun::create([
                'year' => $data['year'],
                'month' => $data['month'],
                'status' => 'draft',
                'created_by' => $request->user()->id,
            ]);
            // Recompute: clear existing draft payslips
            Payslip::where('run_id', $run->id)->delete();

            $users = User::where('role', '!=', 'admin')->where('status', 'active')->get();
            $totalGross = 0; $totalDed = 0; $totalNet = 0;

            $monthStart = Carbon::create($data['year'], $data['month'], 1)->startOfMonth();
            $monthEnd = $monthStart->copy()->endOfMonth();

            foreach ($users as $u) {
                $rate = (float) ($u->hourly_rate ?? 0);
                $allowances = $u->allowances ?? [];
                $allowanceTotal = 0;
                foreach ($allowances as $v) $allowanceTotal += (float) $v;

                // Earned = sum of minutes_worked across the month × hourly rate.
                $minutesWorked = (int) AttendanceLog::where('user_id', $u->id)
                    ->whereBetween('clock_in_at', [$monthStart, $monthEnd])
                    ->sum('minutes_worked');
                $earned = round(($minutesWorked / 60) * $rate, 2);
                $gross = $earned + $allowanceTotal;

                // Deductions: late minutes (we don't double-deduct absences — already not earned).
                $lateMinutes = (int) AttendanceLog::where('user_id', $u->id)
                    ->whereBetween('clock_in_at', [$monthStart, $monthEnd])
                    ->where('status', 'late')->where('justified', false)->sum('late_minutes');
                $lateDed = round(($lateMinutes / 60) * $rate, 2);
                $advanceDed = 0;

                $totalDeductions = $lateDed + $advanceDed;
                $net = max(0, $gross - $totalDeductions);

                Payslip::create([
                    'run_id' => $run->id,
                    'user_id' => $u->id,
                    'earned_amount' => $earned,
                    'allowances' => $allowances,
                    'deductions' => [
                        'late' => $lateDed,
                        'advance' => $advanceDed,
                    ],
                    'gross' => $gross,
                    'total_deductions' => $totalDeductions,
                    'net' => $net,
                    'status' => 'pending',
                ]);

                $totalGross += $gross;
                $totalDed += $totalDeductions;
                $totalNet += $net;
            }

            $run->update([
                'total_gross' => $totalGross,
                'total_deductions' => $totalDed,
                'total_net' => $totalNet,
                'employee_count' => $users->count(),
            ]);

            $payslips = Payslip::where('run_id', $run->id)->with('user:id,name,department,main_job')->get()
                ->map(fn ($p) => $p->toApiArray());

            return response()->json(['run' => $run->fresh()->toApiArray(), 'payslips' => $payslips]);
        });
    }

    public function showPayrollRun(Request $request, $id)
    {
        if ($r = $this->gate($request)) return $r;
        $run = PayrollRun::findOrFail($id);
        $payslips = Payslip::where('run_id', $id)->with('user:id,name,department,main_job')->get()
            ->map(fn ($p) => $p->toApiArray());
        return response()->json(['run' => $run->toApiArray(), 'payslips' => $payslips]);
    }

    public function updatePayslip(Request $request, $id)
    {
        if ($r = $this->gate($request)) return $r;
        $p = Payslip::findOrFail($id);
        if ($p->run && $p->run->isLocked()) {
            return response()->json(['message' => 'Payslip locked'], 422);
        }
        $data = $request->validate([
            'allowances' => 'nullable|array',
            'deductions' => 'nullable|array',
        ]);
        if (isset($data['allowances'])) $p->allowances = $data['allowances'];
        if (isset($data['deductions'])) {
            $p->deductions = $data['deductions'];
            $p->total_deductions = array_sum(array_map('floatval', $data['deductions']));
        }
        $allowanceTotal = array_sum(array_map('floatval', $p->allowances ?? []));
        $p->gross = (float) $p->earned_amount + $allowanceTotal;
        $p->net = max(0, $p->gross - (float) $p->total_deductions);
        $p->save();
        return response()->json($p->fresh()->toApiArray());
    }

    public function approvePayrollRun(Request $request, $id)
    {
        if ($r = $this->gate($request)) return $r;
        $run = PayrollRun::findOrFail($id);
        if ($run->status !== 'draft') {
            return response()->json(['message' => 'Only draft runs can be approved'], 422);
        }
        $run->status = 'approved';
        $run->approved_by = $request->user()->id;
        $run->approved_at = now();
        $run->save();
        return response()->json($run->toApiArray());
    }

    public function payPayslip(Request $request, $id)
    {
        if ($r = $this->gate($request)) return $r;
        $p = Payslip::findOrFail($id);
        if ($p->status === 'paid') {
            return response()->json($p->toApiArray());
        }
        $p->status = 'paid';
        $p->paid_at = now();
        $p->save();

        // Emit finance transaction
        \App\Models\FinanceTransaction::updateOrCreate(
            ['ref_type' => 'payslip', 'ref_id' => $p->id, 'type' => 'payment'],
            [
                'source' => 'payroll',
                'party_type' => 'employee',
                'party_id' => $p->user_id,
                'party_name' => $p->user?->name,
                'amount' => $p->net,
                'method' => 'bank',
                'reference_no' => 'PAYSLIP-' . $p->id,
                'date' => now()->toDateString(),
                'notes' => 'Salary payment',
                'status' => 'completed',
                'created_by' => $request->user()->id,
            ]
        );

        // If all paid, mark run as paid
        $unpaid = Payslip::where('run_id', $p->run_id)->where('status', '!=', 'paid')->count();
        if ($unpaid === 0) {
            $p->run->update(['status' => 'paid', 'paid_at' => now()]);
        }

        return response()->json($p->fresh()->toApiArray());
    }

    // ===== Salary increments =====

    public function listIncrements(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $q = SalaryIncrement::with('user:id,name,department', 'createdBy:id,name')
            ->orderByDesc('effective_date')->orderByDesc('id');
        if ($u = $request->query('user_id')) $q->where('user_id', $u);
        return response()->json($q->limit(500)->get()->map->toApiArray());
    }

    public function storeIncrement(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'type' => 'required|in:annual,promotion,bonus,adjustment',
            'mode' => 'required|in:amount,percentage',
            'value' => 'required|numeric|min:0',
            'effective_date' => 'required|date',
            'reason' => 'nullable|string',
        ]);
        $u = User::findOrFail($data['user_id']);
        $oldRate = (float) ($u->hourly_rate ?? 0);
        $amount = $data['mode'] === 'amount' ? (float) $data['value'] : round($oldRate * (float) $data['value'] / 100, 2);
        $newRate = $oldRate + $amount;
        $percentage = $data['mode'] === 'percentage' ? (float) $data['value'] : ($oldRate > 0 ? round($amount / $oldRate * 100, 3) : null);

        $apply = Carbon::parse($data['effective_date'])->lte(Carbon::today());

        $inc = SalaryIncrement::create([
            'user_id' => $data['user_id'],
            'type' => $data['type'],
            'old_salary' => $oldRate,
            'new_salary' => $newRate,
            'amount' => $amount,
            'percentage' => $percentage,
            'effective_date' => $data['effective_date'],
            'reason' => $data['reason'] ?? null,
            'created_by' => $request->user()->id,
            'applied' => $apply,
            'applied_at' => $apply ? now() : null,
        ]);

        if ($apply) {
            $u->hourly_rate = $newRate;
            $u->save();
        }

        return response()->json($inc->toApiArray(), 201);
    }

    // ===== Leave balances =====

    public function leaveBalances(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $users = User::where('role', '!=', 'admin')->where('status', 'active')->orderBy('name')->get();
        $rows = $users->map(function ($u) {
            $used = LeaveRequest::where('user_id', $u->id)->where('status', 'approved')->sum('days_count');
            $balance = (float) ($u->annual_leave_balance ?? 0);
            return [
                'userId' => (string) $u->id,
                'name' => $u->name,
                'department' => $u->department,
                'balance' => $balance,
                'used' => (float) $used,
                'remaining' => max(0, $balance - (float) $used),
            ];
        });
        return response()->json($rows);
    }

    public function adjustLeaveBalance(Request $request, $userId)
    {
        if ($r = $this->gate($request)) return $r;
        $data = $request->validate([
            'annual_leave_balance' => 'required|numeric|min:0',
            'note' => 'nullable|string',
        ]);
        $u = User::findOrFail($userId);
        $u->annual_leave_balance = $data['annual_leave_balance'];
        $u->save();
        return response()->json($u->toApiArray());
    }

    // ===== HR Reports =====

    public function reportAbsenceTardiness(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $year = (int) $request->query('year', date('Y'));
        $month = (int) $request->query('month', date('n'));
        $start = Carbon::create($year, $month, 1)->startOfMonth();
        $end = $start->copy()->endOfMonth();

        $rows = User::where('role', '!=', 'admin')->where('status', 'active')->get()->map(function ($u) use ($start, $end) {
            $logs = AttendanceLog::where('user_id', $u->id)->whereBetween('clock_in_at', [$start, $end])->get();
            return [
                'userId' => (string) $u->id,
                'name' => $u->name,
                'department' => $u->department,
                'absenceDays' => $logs->where('status', 'absent')->count(),
                'lateCount' => $logs->where('status', 'late')->count(),
                'lateMinutes' => (int) $logs->where('status', 'late')->sum('late_minutes'),
                'unjustifiedAbsences' => $logs->where('status', 'absent')->where('justified', false)->count(),
            ];
        });

        return response()->json(['year' => $year, 'month' => $month, 'rows' => $rows]);
    }

    public function reportPayroll(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $year = (int) $request->query('year', date('Y'));
        $rows = PayrollRun::where('year', $year)->orderBy('month')->get()->map->toApiArray();
        return response()->json(['year' => $year, 'rows' => $rows]);
    }

    // ===== Work schedule settings (HR-accessible mirror of the finance endpoint) =====

    public function workScheduleSettings(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        return response()->json(WorkScheduleSetting::current()->toApiArray());
    }

    public function updateWorkScheduleSettings(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $s = WorkScheduleSetting::current();
        $s->update($request->only([
            'work_start', 'work_end', 'grace_minutes', 'work_days',
            'late_deduction_per_minute', 'absence_deduction_formula',
            'vat_rate', 'employee_insurance_pct', 'employer_insurance_pct',
        ]));
        return response()->json($s->fresh()->toApiArray());
    }
}
