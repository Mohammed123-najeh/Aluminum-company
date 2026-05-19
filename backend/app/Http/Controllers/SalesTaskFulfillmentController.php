<?php

namespace App\Http\Controllers;

use App\Models\Inventory;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Task;
use App\Models\User;
use App\Services\InAppNotifier;
use App\Support\InventoryPricing;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SalesTaskFulfillmentController extends Controller
{
    /**
     * Sales users: inventory rows with suggested list price (per unit).
     */
    public function inventoryOffers(Request $request)
    {
        $user = $request->user();
        $allowed = $user->role === 'supervisor'
            || ($user->role === 'employee' && $user->employee_type === 'sales');
        if (! $allowed) {
            return response()->json(['message' => 'You cannot access this catalog'], 403);
        }

        $rows = Inventory::with(['profile.category', 'color'])->orderBy('id')->get();

        $data = $rows->map(function (Inventory $inv) {
            $inv->loadMissing(['profile.category', 'color']);

            return [
                'inventoryId' => $inv->id,
                'profileId' => $inv->profile_id,
                'profileCode' => $inv->profile?->profile_id,
                'profileName' => $inv->profile?->name,
                'categoryCode' => $inv->profile?->category_code,
                'categoryName' => $inv->profile?->category?->category_name,
                'usage' => $inv->profile?->usage,
                'colorCode' => $inv->color_code,
                'colorName' => $inv->color?->name,
                'quantity' => (int) $inv->quantity,
                'unitPrice' => InventoryPricing::unitPrice($inv),
            ];
        });

        return response()->json($data);
    }

    /**
     * Create or finalize an order from stock, deduct inventory, complete order & task, issue receipt.
     */
    public function fulfill(Request $request)
    {
        $user = $request->user();
        $canFulfill = $user->role === 'supervisor'
            || ($user->role === 'employee' && $user->employee_type === 'sales');
        if (! $canFulfill) {
            return response()->json(['message' => 'You cannot fulfill tasks from inventory'], 403);
        }

        $data = $request->validate([
            'task_id' => 'required|exists:tasks,id',
            'customer_reference' => 'nullable|string|max:255',
            'items' => 'required|array|min:1',
            'items.*.inventory_id' => 'required|exists:inventory,id',
            'items.*.quantity' => 'required|integer|min:1',
            'initial_amount_paid' => 'nullable|numeric|min:0',
            'payment_due_at' => 'nullable|date',
            'payment_notes' => 'nullable|string|max:2000',
        ]);

        $task = Task::query()->with('assignees')->findOrFail($data['task_id']);
        if ($user->role === 'supervisor') {
            if ((int) $task->supervisor_id !== (int) $user->id) {
                return response()->json(['message' => 'You can only fulfill tasks you own'], 403);
            }
        } elseif (! $task->assignees->contains('id', $user->id)) {
            return response()->json(['message' => 'You are not assigned to this task'], 403);
        }
        if (in_array($task->status, ['completed', 'cancelled'], true)) {
            return response()->json(['message' => 'Task cannot be fulfilled in this state'], 400);
        }

        return DB::transaction(function () use ($user, $task, $data) {
            $task->load('order');
            if ($task->order_id) {
                $existing = Order::query()->lockForUpdate()->find($task->order_id);
                if ($existing && $existing->status !== 'draft') {
                    throw new HttpResponseException(
                        response()->json(['message' => 'This task is already linked to a finalized order'], 400)
                    );
                }
            }

            $order = null;
            if ($task->order_id) {
                $order = Order::query()->lockForUpdate()->find($task->order_id);
                $order->items()->delete();
            } else {
                $supervisorId = $user->role === 'supervisor'
                    ? $user->id
                    : $user->supervisor_id;
                if (! $supervisorId) {
                    throw new HttpResponseException(
                        response()->json(['message' => 'Cannot determine supervisor for this order'], 422)
                    );
                }
                $order = Order::create([
                    'creator_id' => $user->id,
                    'supervisor_id' => $supervisorId,
                    'client_id' => $task->client_id,
                    'status' => 'draft',
                    'customer_reference' => $data['customer_reference'] ?? null,
                ]);
                $task->order_id = $order->id;
                $task->status = Task::STATUS_IN_PROGRESS;
                $task->save();
            }

            $order->customer_reference = $data['customer_reference'] ?? $order->customer_reference;
            $order->save();

            $grand = 0.0;
            $linesOut = [];

            foreach ($data['items'] as $line) {
                $inv = Inventory::query()->lockForUpdate()->findOrFail($line['inventory_id']);
                $qty = (int) $line['quantity'];
                if ($qty < 1) {
                    throw new HttpResponseException(response()->json(['message' => 'Invalid quantity'], 422));
                }
                if ((int) $inv->quantity < $qty) {
                    throw new HttpResponseException(response()->json([
                        'message' => 'Insufficient stock for '.$inv->profile?->name.' / '.$inv->color_code,
                    ], 422));
                }

                $unit = InventoryPricing::unitPrice($inv);
                $lineTotal = round($unit * $qty, 2);
                $grand += $lineTotal;

                OrderItem::create([
                    'order_id' => $order->id,
                    'profile_id' => $inv->profile_id,
                    'color_code' => $inv->color_code,
                    'quantity' => $qty,
                    'notes' => null,
                    'unit_price' => $unit,
                    'line_total' => $lineTotal,
                ]);

                $inv->quantity = max(0, (int) $inv->quantity - $qty);
                $inv->save();

                $inv->load(['profile', 'color']);
                $linesOut[] = [
                    'profileName' => $inv->profile?->name,
                    'colorName' => $inv->color?->name,
                    'quantity' => $qty,
                    'unitPrice' => $unit,
                    'lineTotal' => $lineTotal,
                ];
            }

            $receiptNumber = $this->nextReceiptNumber();

            $order->total_amount = round($grand, 2);
            $order->currency = 'ILS';
            $order->receipt_number = $receiptNumber;
            $order->status = 'completed';
            $order->client_id = $task->client_id ?? $order->client_id;
            $initialPaid = isset($data['initial_amount_paid']) ? round((float) $data['initial_amount_paid'], 2) : 0;
            if ($initialPaid > $order->total_amount + 0.009) {
                throw new HttpResponseException(
                    response()->json(['message' => 'Amount paid cannot exceed order total'], 422)
                );
            }
            $order->amount_paid = $initialPaid;
            $order->payment_due_at = $data['payment_due_at'] ?? null;
            $order->payment_notes = $data['payment_notes'] ?? null;
            $order->save();

            // Only the assigned employee actually doing the work should mark the task complete.
            // When a supervisor fulfills stock at creation time (the wizard's Step 2), they're
            // just pre-allocating inventory + issuing a receipt — the task itself stays pending
            // so the assignee still sees it as work to be done.
            $isAssigneeFulfilling = $task->assignees->contains('id', $user->id);
            if ($isAssigneeFulfilling) {
                $task->status = Task::STATUS_COMPLETED;
                $task->completed_at = now();
                $task->save();

                $supervisor = User::find($task->supervisor_id);
                if ($supervisor) {
                    InAppNotifier::taskStatusForSupervisor($supervisor, $task->fresh(), $user, Task::STATUS_COMPLETED);
                }
            }

            $total = (float) $order->total_amount;
            $paid = (float) ($order->amount_paid ?? 0);

            return response()->json([
                'orderId' => (string) $order->id,
                'receiptNumber' => $receiptNumber,
                'totalAmount' => $total,
                'amountPaid' => $paid,
                'balanceDue' => round(max(0, $total - $paid), 2),
                'paymentStatus' => Order::derivePaymentStatus($total, $paid),
                'paymentDueAt' => $order->payment_due_at?->toDateString(),
                'currency' => $order->currency,
                'customerReference' => $order->customer_reference,
                'taskId' => (string) $task->id,
                'lines' => $linesOut,
                'issuedAt' => $order->updated_at->toIso8601String(),
            ], 201);
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
