<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class MyEmployeesController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'supervisor') {
            return response()->json(['message' => 'Only supervisors can list their employees'], 403);
        }

        // Only the supervisor's own operational team: exclude employees with a special
        // employee_type (hr / accountant / sales) — those are cross-functional roles
        // assigned to a supervisor only for org-chart purposes, not part of his crew.
        $employees = $user->subordinates()
            ->where(function ($q) {
                $q->whereNull('employee_type')
                  ->orWhereNotIn('employee_type', ['hr', 'accountant', 'sales']);
            })
            ->orderBy('created_at')
            ->get();

        return response()->json($employees->map(fn ($u) => $u->toApiArray()));
    }
}
