<?php

namespace App\Services;

use App\Models\Inventory;
use App\Models\Order;
use App\Models\Task;
use App\Support\InventoryPricing;
use Illuminate\Support\Facades\DB;

/**
 * When an employee completes a task that has a linked draft order (e.g. created from "Create order from task"),
 * finalize that order: line pricing, total, receipt number, and status completed so it appears in receipts.
 */
class FinalizeDraftOrderForCompletedTask
{
    public function finalize(Task $task): void
    {
        if ($task->status !== Task::STATUS_COMPLETED) {
            return;
        }
        if (! $task->order_id) {
            return;
        }

        DB::transaction(function () use ($task) {
            $order = Order::query()->lockForUpdate()->with('items')->find($task->order_id);
            if (! $order || $order->status !== 'draft') {
                return;
            }

            // Custom orders (created from the supervisor's "custom order" builder) carry
            // a supervisor-entered total but NO line items. Stock-fulfilled orders carry
            // priced items. Both must finalize so the accountant's Orders + Receipts
            // pipeline (and therefore Finance) can see them — previously item-less orders
            // returned here and stayed 'draft' forever, invisible to Finance.
            if ($order->items->isNotEmpty()) {
                $grand = 0.0;

                foreach ($order->items as $item) {
                    $inv = Inventory::query()
                        ->where('profile_id', $item->profile_id)
                        ->where('color_code', $item->color_code)
                        ->orderBy('id')
                        ->first();

                    $unit = $inv
                        ? InventoryPricing::unitPrice($inv)
                        : InventoryPricing::unitPriceForProfileColor((int) $item->profile_id, (string) $item->color_code);

                    $qty = (int) $item->quantity;
                    $lineTotal = round($unit * $qty, 2);
                    $grand += $lineTotal;

                    $item->unit_price = $unit;
                    $item->line_total = $lineTotal;
                    $item->save();
                }

                $order->total_amount = round($grand, 2);
            }
            // else: keep the supervisor-entered total_amount as-is.

            $order->currency = 'ILS';
            $order->receipt_number = $this->nextReceiptNumber();
            $order->status = 'completed';
            $order->client_id = $task->client_id;
            // Stamp the customer name onto the order so finance keeps showing it even
            // if the task is deleted later (only when the order has no name yet).
            if (! $order->customer_reference && $task->customer_name) {
                $order->customer_reference = $task->customer_name;
            }
            if ($order->amount_paid === null) {
                $order->amount_paid = 0;
            }
            $order->save();
        });
    }

    /**
     * Finalize a freshly-minted custom-order draft *at creation time* so its money
     * (total + any down-payment) is immediately visible to the accountant's Orders
     * + Receipts pipeline / Finance — bespoke manufacturing can take weeks, but the
     * receivable and the deposit must be tracked the moment the order is taken.
     *
     * Only acts on a draft that carries a positive total (the custom-order shape).
     * Stock-fulfilled orders keep their items-driven completion path untouched.
     */
    public function finalizeCustomOrderNow(Order $order, ?int $clientId = null): void
    {
        DB::transaction(function () use ($order, $clientId) {
            $locked = Order::query()->lockForUpdate()->find($order->id);
            if (! $locked || $locked->status !== 'draft') {
                return;
            }
            if (($locked->total_amount ?? 0) <= 0) {
                return;
            }

            $locked->currency = 'ILS';
            $locked->receipt_number = $locked->receipt_number ?? $this->nextReceiptNumber();
            $locked->status = 'completed';
            if ($clientId !== null) {
                $locked->client_id = $clientId;
            }
            if ($locked->amount_paid === null) {
                $locked->amount_paid = 0;
            }
            $locked->save();
        });
    }

    private function nextReceiptNumber(): string
    {
        $prefix = 'RCP-'.date('Y').'-';
        $last = Order::query()
            ->whereNotNull('receipt_number')
            ->where('receipt_number', 'like', $prefix.'%')
            ->orderByDesc('receipt_number')
            ->value('receipt_number');
        $n = 1;
        if ($last && preg_match('/-(\d+)$/', $last, $m)) {
            $n = (int) $m[1] + 1;
        }

        return $prefix.str_pad((string) $n, 5, '0', STR_PAD_LEFT);
    }
}
