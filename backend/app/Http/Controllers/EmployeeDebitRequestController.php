<?php

namespace App\Http\Controllers;

use App\Models\EmployeeDebitRequest;
use App\Services\InAppNotifier;
use Illuminate\Http\Request;

class EmployeeDebitRequestController extends Controller
{
    public function mine(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'employee') {
            return response()->json(['message' => 'Only employees can submit salary advance requests'], 403);
        }

        $rows = EmployeeDebitRequest::query()
            ->where('user_id', $user->id)
            ->with('decidedBy:id,name')
            ->orderByDesc('created_at')
            ->get();

        return response()->json($rows->map(fn ($row) => $row->toApiArray())->values());
    }

    public function index(Request $request)
    {
        $user = $request->user();
        if (! $user->isHrStaff() && $user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $query = EmployeeDebitRequest::query()
            ->with('user:id,name,email', 'decidedBy:id,name')
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }

        return response()->json($query->get()->map(fn ($row) => $row->toApiArray())->values());
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'employee') {
            return response()->json(['message' => 'Only employees can submit salary advance requests'], 403);
        }

        $data = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'reason' => 'nullable|string|max:5000',
        ]);

        $row = EmployeeDebitRequest::create([
            'user_id' => $user->id,
            'amount' => round((float) $data['amount'], 2),
            'reason' => $data['reason'] ?? null,
            'status' => EmployeeDebitRequest::STATUS_PENDING,
        ]);

        InAppNotifier::debitRequestSubmitted($row->fresh(['user:id,name']));

        return response()->json($row->fresh(['user:id,name,email', 'decidedBy:id,name'])->toApiArray(), 201);
    }

    public function decide(Request $request, EmployeeDebitRequest $debitRequest)
    {
        $user = $request->user();
        if (! $user->isHrStaff() && $user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        if ($debitRequest->status !== EmployeeDebitRequest::STATUS_PENDING) {
            return response()->json(['message' => 'Only pending requests can be decided'], 400);
        }

        $data = $request->validate([
            'status' => 'required|in:approved,rejected',
            'decision_note' => 'nullable|string|max:5000',
        ]);

        $debitRequest->status = $data['status'];
        $debitRequest->decided_by = $user->id;
        $debitRequest->decided_at = now();
        $debitRequest->decision_note = $data['decision_note'] ?? null;
        $debitRequest->save();

        $employee = $debitRequest->user;
        if ($employee) {
            InAppNotifier::debitRequestDecided($employee, $debitRequest->fresh());
        }

        return response()->json($debitRequest->fresh(['user:id,name,email', 'decidedBy:id,name'])->toApiArray());
    }

    public function cancel(Request $request, EmployeeDebitRequest $debitRequest)
    {
        $user = $request->user();
        if ((int) $debitRequest->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        if ($debitRequest->status !== EmployeeDebitRequest::STATUS_PENDING) {
            return response()->json(['message' => 'Only pending requests can be cancelled'], 400);
        }

        $debitRequest->status = EmployeeDebitRequest::STATUS_CANCELLED;
        $debitRequest->save();

        return response()->json($debitRequest->fresh(['user:id,name,email', 'decidedBy:id,name'])->toApiArray());
    }
}
