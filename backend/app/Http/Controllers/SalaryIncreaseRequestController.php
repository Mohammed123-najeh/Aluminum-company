<?php

namespace App\Http\Controllers;

use App\Models\SalaryIncreaseRequest;
use App\Services\InAppNotifier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SalaryIncreaseRequestController extends Controller
{
    public function mine(Request $request)
    {
        $user = $request->user();
        $rows = SalaryIncreaseRequest::where('user_id', $user->id)->orderByDesc('created_at')->get();

        return response()->json($rows->map(fn($r) => $r->toApiArray()));
    }

    public function indexHr(Request $request)
    {
        $me = $request->user();
        if (!$me->isHrStaff() && $me->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $q = SalaryIncreaseRequest::query()->with(['user:id,name,email', 'decidedBy:id,name']);
        if ($request->query('status')) {
            $q->where('status', $request->query('status'));
        }

        $rows = $q->orderByDesc('created_at')->limit(500)->get();

        return response()->json($rows->map(fn($r) => $r->toApiArray()));
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'employee') {
            return response()->json(['message' => 'Only employees may submit salary requests'], 403);
        }

        $data = $request->validate([
            'requested_monthly_salary' => 'required|numeric|min:0',
            'reason'                   => 'nullable|string|max:2000',
        ]);

        $row = SalaryIncreaseRequest::create([
            'user_id'                 => $user->id,
            'current_salary_snapshot' => $user->base_salary,
            'requested_monthly_salary'=> $data['requested_monthly_salary'],
            'reason'                  => $data['reason'] ?? null,
            'status'                  => 'pending',
        ]);

        InAppNotifier::salaryRequestSubmitted($row->fresh(['user:id,name']));

        return response()->json($row->fresh()->toApiArray(), 201);
    }

    public function decide(Request $request, SalaryIncreaseRequest $salaryIncreaseRequest)
    {
        $me = $request->user();
        if ($me->role !== 'admin') {
            return response()->json(['message' => 'Only administrators may approve salary changes'], 403);
        }

        $data = $request->validate([
            'status'                => 'required|in:approved,rejected',
            'approved_monthly_salary'=> 'nullable|numeric|min:0',
            'decision_note'         => 'nullable|string|max:2000',
        ]);

        if ($salaryIncreaseRequest->status !== 'pending') {
            return response()->json(['message' => 'Request is no longer pending'], 422);
        }

        return DB::transaction(function () use ($salaryIncreaseRequest, $data, $me) {
            $employee = $salaryIncreaseRequest->user;
            if (!$employee) {
                return response()->json(['message' => 'Employee not found'], 404);
            }

            $salaryIncreaseRequest->decided_by = $me->id;
            $salaryIncreaseRequest->decided_at = now();
            $salaryIncreaseRequest->decision_note = $data['decision_note'] ?? null;
            $salaryIncreaseRequest->status = $data['status'];

            if ($data['status'] === 'approved') {
                $approved = isset($data['approved_monthly_salary'])
                    ? (float) $data['approved_monthly_salary']
                    : (float) $salaryIncreaseRequest->requested_monthly_salary;
                $salaryIncreaseRequest->approved_monthly_salary = $approved;
                $employee->base_salary = round($approved, 2);
                $employee->save();
            }

            $salaryIncreaseRequest->save();

            InAppNotifier::salaryRequestDecided($employee, $salaryIncreaseRequest->fresh());

            return response()->json($salaryIncreaseRequest->fresh()->toApiArray());
        });
    }

    public function cancel(Request $request, SalaryIncreaseRequest $salaryIncreaseRequest)
    {
        $me = $request->user();
        if ((int) $salaryIncreaseRequest->user_id !== (int) $me->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        if ($salaryIncreaseRequest->status !== 'pending') {
            return response()->json(['message' => 'Only pending requests can be cancelled'], 422);
        }

        $salaryIncreaseRequest->status = 'cancelled';
        $salaryIncreaseRequest->save();

        return response()->json($salaryIncreaseRequest->fresh()->toApiArray());
    }
}
