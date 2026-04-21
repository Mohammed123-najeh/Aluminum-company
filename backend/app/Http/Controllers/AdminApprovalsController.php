<?php

namespace App\Http\Controllers;

use App\Models\AdminSubmission;
use App\Models\SalaryIncreaseRequest;
use Illuminate\Http\Request;

class AdminApprovalsController extends Controller
{
    public function summary(Request $request)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json([
            'pendingSalaryRequests' => SalaryIncreaseRequest::query()->where('status', 'pending')->count(),
            'pendingSubmissions' => AdminSubmission::query()->where('status', 'pending')->count(),
        ]);
    }
}
