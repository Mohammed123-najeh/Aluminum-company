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
            if ($order->items->isEmpty()) {
                return;
            }

            $grand = 0.0;

            foreach ($order->items as $item) {
                $inv = Inventory::query()
                    ->where('profile_id', $item->profile_id)
                    ->where('color_code', $item->color_code)
                    ->orderBy('id')
                    ->first();

                $unit = $inv
                    ? InventoryPricing::unitPricePerM($inv)
                    : InventoryPricing::unitPricePerMForProfileColor((int) $item->profile_id, (string) $item->color_code);

                $qty = (float) $item->quantity_m;
                $lineTotal = round($unit * $qty, 2);
                $grand += $lineTotal;

                $item->unit_price_per_m = $unit;
                $item->line_total = $lineTotal;
                $item->save();
            }

            $order->total_amount = round($grand, 2);
            $order->currency = 'ILS';
            $order->receipt_number = $this->nextReceiptNumber();
            $order->status = 'completed';
            $order->client_id = $task->client_id;
            if ($order->amount_paid === null) {
                $order->amount_paid = 0;
            }
            $order->save();
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
