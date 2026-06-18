<?php

namespace App\Services;

use App\Models\FinanceTransaction;
use App\Models\Order;
use App\Models\OrderPayment;

/**
 * Bridges order payments into the Finance ledger.
 *
 * The Finance dashboard computes revenue/net purely from `finance_transactions`,
 * so an order payment only counts toward revenue once a matching `type=revenue`
 * row exists. We use CASH-BASIS revenue: revenue is recognised when money is
 * actually collected (a positive OrderPayment), and reversed (negative revenue
 * row) when money is refunded on cancellation. This keeps net = revenue - expenses
 * always correct without the dashboard having to read the orders tables.
 *
 * Keyed on the OrderPayment id so re-runs are idempotent (updateOrCreate).
 */
class OrderRevenueRecorder
{
    /**
     * Record (or update) the revenue row for a single OrderPayment.
     * Positive payment → positive revenue; negative payment (refund) → negative
     * revenue, so refunds reduce total revenue rather than inflating expenses.
     */
    public function recordPayment(Order $order, OrderPayment $payment): void
    {
        $amount = round((float) $payment->amount, 2);
        if (abs($amount) < 0.01) {
            return;
        }

        FinanceTransaction::updateOrCreate(
            ['ref_type' => 'order_payment', 'ref_id' => $payment->id, 'type' => FinanceTransaction::TYPE_REVENUE],
            [
                'source' => $amount < 0 ? 'order_refund' : 'order_payment',
                'party_type' => 'client',
                'party_id' => $order->client_id,
                'party_name' => $order->client?->name ?? $order->task?->customer_name ?? $order->customer_reference,
                'amount' => $amount,
                'method' => $payment->method,
                'reference_no' => $order->receipt_number ?? ('ORD-'.$order->id),
                'date' => ($payment->paid_at ?? now())->toDateString(),
                'notes' => $payment->note,
                'status' => 'completed',
                'created_by' => $payment->recorded_by,
            ]
        );
    }

    /**
     * Record revenue for an order's initial paid amount when it is created already
     * carrying a down-payment but WITHOUT an explicit OrderPayment row (e.g. a
     * custom order minted with amount_paid > 0 at task creation). Creates the
     * OrderPayment first so there is an auditable cash record, then the revenue row.
     */
    public function recordInitialPaid(Order $order, float $amountPaid, ?int $recordedBy): void
    {
        $amount = round($amountPaid, 2);
        if ($amount < 0.01) {
            return;
        }

        // Avoid double-recording if an initial payment was already captured.
        $existing = OrderPayment::where('order_id', $order->id)->sum('amount');
        if (round((float) $existing, 2) >= $amount) {
            return;
        }

        $payment = OrderPayment::create([
            'order_id' => $order->id,
            'amount' => round($amount - (float) $existing, 2),
            'paid_at' => now(),
            'recorded_by' => $recordedBy,
            'note' => 'Initial payment on order creation',
            'method' => 'cash',
        ]);

        $this->recordPayment($order, $payment);
    }
}
