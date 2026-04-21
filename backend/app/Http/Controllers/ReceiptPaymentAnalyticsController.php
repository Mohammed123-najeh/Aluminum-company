<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Support\ReceiptPaymentAnalytics;
use Illuminate\Http\Request;

class ReceiptPaymentAnalyticsController extends Controller
{
    /**
     * Receipt & payment KPIs for supervisors (scoped) or admins (all completed receipts).
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if (! in_array($user->role, ['supervisor', 'admin'], true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $q = Order::query()
            ->where('status', 'completed')
            ->whereNotNull('receipt_number')
            ->whereNotNull('total_amount');

        if ($user->role === 'supervisor') {
            $q->where(function ($qq) use ($user) {
                $qq->where('supervisor_id', $user->id)->orWhere('creator_id', $user->id);
            });
        }

        $orders = $q->with(['task:id,title,customer_name,client_id', 'client:id,name,phone', 'creator:id,name'])->get();

        return response()->json(ReceiptPaymentAnalytics::aggregate($orders));
    }
}
