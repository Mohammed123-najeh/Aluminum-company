<?php

namespace App\Http\Controllers;

use App\Models\LeaveRequest;
use App\Services\InAppNotifier;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LeaveRequestController extends Controller
{
    public function mine(Request $request)
    {
        $user = $request->user();
        $rows = LeaveRequest::where('user_id', $user->id)->orderByDesc('created_at')->get();

        return response()->json($rows->map(fn($r) => $r->toApiArray()));
    }

    public function indexHr(Request $request)
    {
        $me = $request->user();
        if (!$me->isHrStaff() && $me->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $q = LeaveRequest::query()->with(['user:id,name,email', 'decidedBy:id,name']);

        if ($request->query('status')) {
            $q->where('status', $request->query('status'));
        }
        if ($request->query('type')) {
            $q->where('type', $request->query('type'));
        }

        $rows = $q->orderByDesc('created_at')->limit(500)->get();

        return response()->json($rows->map(fn($r) => $r->toApiArray()));
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'employee') {
            return response()->json(['message' => 'Only employees may submit leave requests'], 403);
        }

        $data = $request->validate([
            'type'       => 'required|in:holiday,sick',
            'start_date' => 'required|date',
            'end_date'   => 'required|date|after_or_equal:start_date',
            'reason'     => 'nullable|string|max:2000',
        ]);

        $start = Carbon::parse($data['start_date'])->startOfDay();
        $end = Carbon::parse($data['end_date'])->startOfDay();
        $days = (int) $start->diffInDays($end) + 1;

        if ($data['type'] === 'holiday' && $user->annual_leave_balance !== null) {
            $balance = (float) $user->annual_leave_balance;
            if ($balance + 0.0001 < $days) {
                return response()->json([
                    'message' => 'Requested days exceed annual leave balance.',
                    'balance' => (string) $user->annual_leave_balance,
                    'requestedDays' => $days,
                ], 422);
            }
        }

        $leave = LeaveRequest::create([
            'user_id'    => $user->id,
            'type'       => $data['type'],
            'start_date' => $start->toDateString(),
            'end_date'   => $end->toDateString(),
            'days_count' => $days,
            'reason'     => $data['reason'] ?? null,
            'status'     => 'pending',
        ]);

        InAppNotifier::leaveRequestSubmitted($leave->fresh(['user:id,name']));

        return response()->json($leave->fresh()->toApiArray(), 201);
    }

    public function decide(Request $request, LeaveRequest $leaveRequest)
    {
        $me = $request->user();
        if (!$me->isHrStaff() && $me->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'status'       => 'required|in:approved,rejected',
            'decision_note'=> 'nullable|string|max:2000',
        ]);

        if ($leaveRequest->status !== 'pending') {
            return response()->json(['message' => 'Request is no longer pending'], 422);
        }

        return DB::transaction(function () use ($leaveRequest, $data, $me) {
            $user = $leaveRequest->user;
            if (!$user) {
                return response()->json(['message' => 'Employee not found'], 404);
            }

            if ($data['status'] === 'approved' && $leaveRequest->type === 'holiday' && $user->annual_leave_balance !== null) {
                $newBal = (float) $user->annual_leave_balance - $leaveRequest->days_count;
                if ($newBal < -0.0001) {
                    return response()->json(['message' => 'Insufficient annual leave balance for this employee'], 422);
                }
                $user->annual_leave_balance = round($newBal, 1);
                $user->save();
            }

            $leaveRequest->status = $data['status'];
            $leaveRequest->decided_by = $me->id;
            $leaveRequest->decided_at = now();
            $leaveRequest->decision_note = $data['decision_note'] ?? null;
            $leaveRequest->save();

            InAppNotifier::leaveRequestDecided($user, $leaveRequest->fresh());

            return response()->json($leaveRequest->fresh()->toApiArray());
        });
    }

    public function cancel(Request $request, LeaveRequest $leaveRequest)
    {
        $me = $request->user();
        if ((int) $leaveRequest->user_id !== (int) $me->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        if ($leaveRequest->status !== 'pending') {
            return response()->json(['message' => 'Only pending requests can be cancelled'], 422);
        }

        $leaveRequest->status = 'cancelled';
        $leaveRequest->save();

        return response()->json($leaveRequest->fresh()->toApiArray());
    }
}
