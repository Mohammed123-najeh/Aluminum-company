<?php

use App\Models\FinanceTransaction;
use App\Models\Order;
use App\Models\OrderPayment;
use App\Services\OrderRevenueRecorder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * One-time backfill: every existing OrderPayment becomes a revenue FinanceTransaction
 * so the Finance dashboard (which reads revenue purely from finance_transactions)
 * reflects money already collected on past orders. Negative payments (refunds) become
 * negative revenue, keeping net correct. Idempotent — the recorder keys on the
 * OrderPayment id (updateOrCreate), so re-running changes nothing.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('order_payments') || ! Schema::hasTable('finance_transactions')) {
            return;
        }

        $recorder = app(OrderRevenueRecorder::class);

        // 1) Remove old-format refund rows. Refunds used to be written as a separate
        //    payment-type (expense) transaction, which double-counts now that refunds
        //    are negative revenue. Drop them so net is computed from revenue only.
        FinanceTransaction::where('ref_type', 'order_cancellation')
            ->where('type', FinanceTransaction::TYPE_PAYMENT)
            ->delete();

        // 2) Every existing OrderPayment becomes a revenue transaction (refunds negative).
        OrderPayment::query()
            ->with('order')
            ->orderBy('id')
            ->chunkById(500, function ($payments) use ($recorder) {
                foreach ($payments as $payment) {
                    $order = $payment->order ?? Order::find($payment->order_id);
                    if ($order) {
                        $recorder->recordPayment($order, $payment);
                    }
                }
            });

        // 3) Orders that carry amount_paid but have NO payment rows summing to it
        //    (e.g. older orders where the down-payment was set directly on the order)
        //    get the missing revenue recognised so the dashboard reflects real cash.
        Order::query()
            ->where('amount_paid', '>', 0)
            ->orderBy('id')
            ->chunkById(500, function ($orders) use ($recorder) {
                foreach ($orders as $order) {
                    $paid = round((float) ($order->amount_paid ?? 0), 2);
                    $recorded = round((float) OrderPayment::where('order_id', $order->id)->sum('amount'), 2);
                    if ($paid - $recorded > 0.009) {
                        $recorder->recordInitialPaid($order, $paid, $order->creator_id);
                    }
                }
            });
    }

    public function down(): void
    {
        // Remove only the rows this backfill could have created.
        FinanceTransaction::where('ref_type', 'order_payment')
            ->where('type', FinanceTransaction::TYPE_REVENUE)
            ->delete();
    }
};
