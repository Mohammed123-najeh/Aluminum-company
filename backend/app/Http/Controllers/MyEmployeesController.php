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

        $employees = $user->subordinates()
            ->orderBy('created_at')
            ->get();

        return response()->json($employees->map(fn ($u) => $u->toApiArray()));
    }
}
