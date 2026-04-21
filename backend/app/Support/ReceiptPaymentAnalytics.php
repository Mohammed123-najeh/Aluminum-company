<?php

namespace App\Support;

use App\Models\Order;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Aggregates KPIs for completed orders with receipts (supervisor-scoped or all).
 */
class ReceiptPaymentAnalytics
{
    /**
     * @param  Collection<int, Order>  $orders  Pre-filtered completed orders with receipt_number & total_amount
     * @return array<string, mixed>
     */
    public static function aggregate(Collection $orders, ?Carbon $now = null): array
    {
        $now = $now ?? Carbon::now();
        $todayStart = $now->copy()->startOfDay();
        $monthStart = $now->copy()->startOfMonth();
        $yearStart = $now->copy()->startOfYear();
        $nextMonthStart = $now->copy()->addMonthNoOverflow()->startOfMonth();
        $nextMonthEnd = $now->copy()->addMonthNoOverflow()->endOfMonth();

        $sumBucket = function (Collection $coll): array {
            return [
                'count' => $coll->count(),
                'totalBilled' => round((float) $coll->sum(fn (Order $o) => (float) $o->total_amount), 2),
                'totalPaid' => round((float) $coll->sum(fn (Order $o) => (float) ($o->amount_paid ?? 0)), 2),
                'totalOutstanding' => round((float) $coll->sum(fn (Order $o) => max(0, (float) $o->total_amount - (float) ($o->amount_paid ?? 0))), 2),
            ];
        };

        $todayOrders = $orders->filter(fn (Order $o) => $o->updated_at->gte($todayStart));
        $monthOrders = $orders->filter(fn (Order $o) => $o->updated_at->gte($monthStart));
        $yearOrders = $orders->filter(fn (Order $o) => $o->updated_at->gte($yearStart));

        $byStatus = ['paid' => 0, 'partial' => 0, 'unpaid' => 0, 'unknown' => 0];
        foreach ($orders as $o) {
            $st = Order::derivePaymentStatus((float) $o->total_amount, (float) ($o->amount_paid ?? 0));
            $byStatus[$st] = ($byStatus[$st] ?? 0) + 1;
        }

        $overdue = $orders->filter(function (Order $o) use ($now) {
            if (! $o->payment_due_at) {
                return false;
            }
            $bal = max(0, (float) $o->total_amount - (float) ($o->amount_paid ?? 0));

            return $bal > 0.009 && $o->payment_due_at->copy()->endOfDay()->lt($now);
        });

        $dueNextMonth = $orders->filter(function (Order $o) use ($nextMonthStart, $nextMonthEnd) {
            if (! $o->payment_due_at) {
                return false;
            }
            $d = $o->payment_due_at->copy()->startOfDay();

            return $d->gte($nextMonthStart) && $d->lte($nextMonthEnd);
        });

        $customerLabel = function (Order $o): string {
            $n = $o->client?->name;
            if ($n) {
                return trim($n);
            }
            $t = $o->task?->customer_name;

            return $t ? trim($t) : (trim((string) ($o->customer_reference ?? '')) ?: '—');
        };

        $buckets = [];
        foreach ($orders as $o) {
            $label = $customerLabel($o);
            if (! isset($buckets[$label])) {
                $buckets[$label] = ['customerLabel' => $label, 'receiptCount' => 0, 'outstanding' => 0.0];
            }
            $buckets[$label]['receiptCount']++;
            $buckets[$label]['outstanding'] += max(0, (float) $o->total_amount - (float) ($o->amount_paid ?? 0));
        }

        $topOutstanding = collect($buckets)
            ->filter(fn (array $b) => $b['outstanding'] > 0.009)
            ->sortByDesc('outstanding')
            ->take(25)
            ->values()
            ->map(fn (array $b) => [
                'customerLabel' => $b['customerLabel'],
                'receiptCount' => $b['receiptCount'],
                'outstanding' => round($b['outstanding'], 2),
            ])
            ->all();

        $withBalance = $orders->filter(function (Order $o) {
            return max(0, (float) $o->total_amount - (float) ($o->amount_paid ?? 0)) > 0.009;
        });
        $uniqueDebitLabels = $withBalance->map($customerLabel)->unique()->count();

        return [
            'generatedAt' => $now->toIso8601String(),
            'today' => $sumBucket($todayOrders),
            'thisMonth' => $sumBucket($monthOrders),
            'thisYear' => $sumBucket($yearOrders),
            'allTime' => $sumBucket($orders),
            'byPaymentStatus' => $byStatus,
            'overdueCount' => $overdue->count(),
            'overdueOutstanding' => round($overdue->sum(fn (Order $o) => max(0, (float) $o->total_amount - (float) ($o->amount_paid ?? 0))), 2),
            'dueNextMonth' => $sumBucket($dueNextMonth),
            'topOutstandingCustomers' => $topOutstanding,
            'customersWithOutstandingCount' => $uniqueDebitLabels,
        ];
    }
}
