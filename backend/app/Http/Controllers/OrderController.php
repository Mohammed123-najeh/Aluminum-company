<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderPayment;
use App\Models\CustomerInvoice;
use App\Models\FinanceTransaction;
use App\Models\Profile;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class OrderController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Order::with([
            'items.profile.category',
            'items.color',
            'creator:id,name',
            'supervisor:id,name',
            'client:id,name,phone,email',
            'task:id,title,order_id,customer_name,client_id',
        ]);

        if ($user->role === 'admin' || $user->isAccountant()) {
            // Admin sees all orders
        } elseif ($user->role === 'supervisor') {
            $query->where(function ($q) use ($user) {
                $q->where('supervisor_id', $user->id)->orWhere('creator_id', $user->id);
            });
        } else {
            $query->where('creator_id', $user->id);
        }

        $orders = $query->orderBy('updated_at', 'desc')->get();

        if ($request->boolean('receipts_only')) {
            $orders = $orders
                ->filter(fn (Order $o) => in_array($o->status, ['completed', 'cancelled'], true) && $o->receipt_number !== null)
                ->values();
        }

        if ($request->filled('payment_status')) {
            $ps = (string) $request->query('payment_status');
            $orders = $orders
                ->filter(function (Order $o) use ($ps) {
                    $total = $o->total_amount !== null ? (float) $o->total_amount : null;
                    $paid = $o->amount_paid !== null ? (float) $o->amount_paid : null;

                    return Order::derivePaymentStatus($total, $paid) === $ps;
                })
                ->values();
        }

        return response()->json($orders->map(fn ($o) => $this->orderToArray($o)));
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if (! in_array($user->role, ['supervisor', 'employee'])) {
            return response()->json(['message' => 'Only supervisors and employees can create orders'], 403);
        }

        $data = $request->validate([
            'customer_reference' => 'nullable|string|max:255',
            'items' => 'required|array|min:1',
            'items.*.profile_id' => 'required|exists:profiles,id',
            'items.*.color_code' => 'required|exists:colors,color_code',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.notes' => 'nullable|string|max:500',
            'task_id' => 'nullable|exists:tasks,id',
        ]);

        if (! empty($data['task_id'])) {
            $task = Task::query()->find($data['task_id']);
            if (! $task) {
                return response()->json(['message' => 'Task not found'], 404);
            }
            $isAssignee = $task->assignees()->where('user_id', $user->id)->exists();
            $isOwningSupervisor = $user->role === 'supervisor' && (int) $task->supervisor_id === (int) $user->id;
            if (! $isAssignee && ! $isOwningSupervisor) {
                return response()->json(['message' => 'You cannot link this task to an order'], 403);
            }

            if ($task->order_id !== null) {
                $existingOrder = Order::query()->find($task->order_id);
                if (! $existingOrder || $existingOrder->status !== 'draft') {
                    return response()->json(['message' => 'Task is already linked to an order'], 400);
                }
                $canUpdate = $existingOrder->creator_id == $user->id
                    || ($user->role === 'supervisor' && $existingOrder->supervisor_id == $user->id)
                    || $user->role === 'admin';
                if (! $canUpdate) {
                    return response()->json(['message' => 'Forbidden'], 403);
                }
                if ((int) $task->supervisor_id !== (int) $existingOrder->supervisor_id) {
                    return response()->json(['message' => 'Task does not match this order scope'], 403);
                }

                $existingOrder->customer_reference = $data['customer_reference'] ?? null;
                $existingOrder->save();
                $existingOrder->items()->delete();
                foreach ($data['items'] as $item) {
                    $profile = Profile::find($item['profile_id']);
                    OrderItem::create([
                        'order_id' => $existingOrder->id,
                        'profile_id' => $profile->id,
                        'color_code' => $item['color_code'],
                        'quantity' => $item['quantity'],
                        'notes' => $item['notes'] ?? null,
                    ]);
                }
                $existingOrder->load(['items.profile', 'items.color', 'creator:id,name', 'supervisor:id,name', 'client:id,name,phone,email', 'task:id,title,order_id,customer_name,client_id']);

                return response()->json($this->orderToArray($existingOrder->fresh()), 200);
            }
        }

        $taskForClient = ! empty($data['task_id']) ? Task::query()->find($data['task_id']) : null;

        $order = Order::create([
            'creator_id' => $user->id,
            'supervisor_id' => $user->role === 'supervisor' ? $user->id : $user->supervisor_id,
            'client_id' => $taskForClient?->client_id,
            'status' => 'draft',
            'customer_reference' => $data['customer_reference'] ?? null,
        ]);

        foreach ($data['items'] as $item) {
            $profile = Profile::find($item['profile_id']);
            OrderItem::create([
                'order_id' => $order->id,
                'profile_id' => $profile->id,
                'color_code' => $item['color_code'],
                'quantity' => $item['quantity'],
                'notes' => $item['notes'] ?? null,
            ]);
        }

        if (! empty($data['task_id'])) {
            $task = Task::query()->find($data['task_id']);
            if ($task && (int) $task->supervisor_id === (int) $order->supervisor_id) {
                $task->order_id = $order->id;
                $task->status = Task::STATUS_IN_PROGRESS;
                $task->save();
            }
        }

        $order->load(['items.profile', 'items.color', 'creator:id,name', 'supervisor:id,name', 'client:id,name,phone,email', 'task:id,title,order_id,customer_name,client_id']);
        return response()->json($this->orderToArray($order->fresh()), 201);
    }

    public function show(Request $request, Order $order)
    {
        $user = $request->user();
        if ($user->role === 'admin' || $user->isAccountant()) {
            // OK
        } elseif ($user->role === 'supervisor' && $order->supervisor_id != $user->id && $order->creator_id != $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        } elseif ($user->role === 'employee' && $order->creator_id != $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $order->load(['items.profile.category', 'items.color', 'creator:id,name', 'supervisor:id,name', 'client:id,name,phone,email', 'task:id,title,order_id,customer_name,client_id']);
        return response()->json($this->orderToArray($order));
    }

    public function update(Request $request, Order $order)
    {
        $user = $request->user();
        $canUpdate = $order->creator_id == $user->id
            || ($user->role === 'supervisor' && $order->supervisor_id == $user->id)
            || $user->role === 'admin';
        if (! $canUpdate) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        if ($order->status !== 'draft') {
            return response()->json(['message' => 'Only draft orders can be updated'], 400);
        }

        $data = $request->validate([
            'customer_reference' => 'nullable|string|max:255',
            'status' => 'sometimes|in:draft,submitted,in_progress,completed,cancelled',
            'items' => 'sometimes|array|min:0',
            'items.*.profile_id' => 'required_with:items|exists:profiles,id',
            'items.*.color_code' => 'required_with:items|exists:colors,color_code',
            'items.*.quantity' => 'required_with:items|integer|min:1',
            'items.*.notes' => 'nullable|string|max:500',
        ]);

        if (isset($data['customer_reference'])) {
            $order->customer_reference = $data['customer_reference'];
        }
        if (isset($data['status'])) {
            $order->status = $data['status'];
        }
        if (isset($data['items'])) {
            $order->items()->delete();
            foreach ($data['items'] as $item) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'profile_id' => $item['profile_id'],
                    'color_code' => $item['color_code'],
                    'quantity' => $item['quantity'],
                    'notes' => $item['notes'] ?? null,
                ]);
            }
        }
        $order->save();
        $order->load(['items.profile.category', 'items.color', 'creator:id,name', 'supervisor:id,name', 'client:id,name,phone,email', 'task:id,title,order_id,customer_name,client_id']);
        return response()->json($this->orderToArray($order->fresh()));
    }

    public function updatePayment(Request $request, Order $order)
    {
        $user = $request->user();
        // Subsequent partial payments on completed orders are recorded by Finance
        // (accountants) and admins only. Supervisors set the initial total + paid
        // amount at task creation; later top-ups go through Finance.
        $can = $user->role === 'admin' || $user->isAccountant();
        if (! $can) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        if ($order->status !== 'completed') {
            return response()->json(['message' => 'Payment can only be recorded on completed orders'], 400);
        }

        $data = $request->validate([
            'amount_paid' => 'required|numeric|min:0',
            'payment_due_at' => 'nullable|date',
            'payment_notes' => 'nullable|string|max:2000',
        ]);

        $prevPaid = (float) ($order->amount_paid ?? 0);
        $order->amount_paid = round((float) $data['amount_paid'], 2);
        if (array_key_exists('payment_due_at', $data)) {
            $order->payment_due_at = $data['payment_due_at'] ?? null;
        }
        if (array_key_exists('payment_notes', $data)) {
            $order->payment_notes = $data['payment_notes'] ?? null;
        }
        $order->save();

        $newPaid = (float) ($order->amount_paid ?? 0);
        $diff = round($newPaid - $prevPaid, 2);
        if (Schema::hasTable('order_payments') && $diff > 0.009) {
            OrderPayment::create([
                'order_id' => $order->id,
                'amount' => $diff,
                'paid_at' => now(),
                'recorded_by' => $user->id,
                'note' => 'Adjusted via legacy update payment',
            ]);
        }

        $order->load(['items.profile.category', 'items.color', 'creator:id,name', 'supervisor:id,name', 'client:id,name,phone,email', 'task:id,title,order_id,customer_name,client_id']);

        return response()->json($this->orderToArray($order->fresh()));
    }

    public function listPayments(Request $request, Order $order)
    {
        $user = $request->user();
        if (! $this->userCanViewOrder($user, $order)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        if (! Schema::hasTable('order_payments')) {
            return response()->json([]);
        }
        $rows = OrderPayment::query()
            ->where('order_id', $order->id)
            ->orderBy('paid_at')
            ->orderBy('id')
            ->get();

        return response()->json($rows->map(fn ($p) => $p->toApiArray())->values());
    }

    public function addPayment(Request $request, Order $order)
    {
        $user = $request->user();
        // Subsequent partial payments on completed orders are recorded by Finance
        // (accountants) and admins only. Supervisors set the initial total + paid
        // amount at task creation; later top-ups go through Finance.
        $can = $user->role === 'admin' || $user->isAccountant();
        if (! $can) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        if ($order->status !== 'completed' || ! Schema::hasTable('order_payments')) {
            return response()->json(['message' => 'Payment entries are only for completed orders'], 400);
        }

        $data = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'paid_at' => 'nullable|date',
            'note' => 'nullable|string|max:2000',
            'method' => 'nullable|in:cash,transfer,check,card',
            'cheque_bank' => 'nullable|string|max:120',
            'cheque_number' => 'nullable|string|max:80',
            'cheque_holder' => 'nullable|string|max:160',
            'cheque_amount' => 'nullable|numeric|min:0',
            'cheque_issue_date' => 'nullable|date',
            'cheque_due_date' => 'nullable|date',
            'cheque_status' => 'nullable|in:pending,cleared,bounced,cancelled',
        ]);

        $total = $order->total_amount !== null ? (float) $order->total_amount : 0.0;
        $current = (float) ($order->amount_paid ?? 0);
        $remaining = max(0, round($total - $current, 2));
        $requested = round((float) $data['amount'], 2);
        $add = min($requested, $remaining);
        if ($add < 0.01) {
            return response()->json(['message' => 'Amount exceeds balance due or no balance remaining.'], 422);
        }

        $paidAt = isset($data['paid_at']) ? \Carbon\Carbon::parse($data['paid_at']) : now();
        $method = $data['method'] ?? null;

        return DB::transaction(function () use ($order, $add, $paidAt, $data, $user, $method) {
            $payment = OrderPayment::create([
                'order_id' => $order->id,
                'amount' => $add,
                'paid_at' => $paidAt,
                'recorded_by' => $user->id,
                'note' => $data['note'] ?? null,
                'method' => $method,
                'cheque_bank' => $method === 'check' ? ($data['cheque_bank'] ?? null) : null,
                'cheque_number' => $method === 'check' ? ($data['cheque_number'] ?? null) : null,
                'cheque_holder' => $method === 'check' ? ($data['cheque_holder'] ?? null) : null,
                'cheque_amount' => $method === 'check' ? ($data['cheque_amount'] ?? null) : null,
                'cheque_issue_date' => $method === 'check' ? ($data['cheque_issue_date'] ?? null) : null,
                'cheque_due_date' => $method === 'check' ? ($data['cheque_due_date'] ?? null) : null,
                'cheque_status' => $method === 'check' ? ($data['cheque_status'] ?? 'pending') : null,
            ]);
            $order->amount_paid = round((float) ($order->amount_paid ?? 0) + $add, 2);
            $order->save();
            $order->load(['items.profile.category', 'items.color', 'creator:id,name', 'supervisor:id,name', 'client:id,name,phone,email', 'task:id,title,order_id,customer_name,client_id']);

            $fresh = $this->orderToArray($order->fresh());
            $fresh['lastPayment'] = $payment->toApiArray();

            return response()->json($fresh);
        });
    }

    public function updateReceiptMeta(Request $request, Order $order)
    {
        $user = $request->user();
        // Subsequent partial payments on completed orders are recorded by Finance
        // (accountants) and admins only. Supervisors set the initial total + paid
        // amount at task creation; later top-ups go through Finance.
        $can = $user->role === 'admin' || $user->isAccountant();
        if (! $can) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        if ($order->status !== 'completed' || $order->receipt_number === null) {
            return response()->json(['message' => 'Only issued receipts can be edited here'], 400);
        }

        $data = $request->validate([
            'customer_reference' => 'nullable|string|max:255',
        ]);

        $order->customer_reference = $data['customer_reference'] ?? null;
        $order->save();
        $order->load(['items.profile.category', 'items.color', 'creator:id,name', 'supervisor:id,name', 'client:id,name,phone,email', 'task:id,title,order_id,customer_name,client_id']);

        return response()->json($this->orderToArray($order->fresh()));
    }

    public function cancel(Request $request, Order $order)
    {
        $user = $request->user();
        $canCancel = $user->role === 'admin'
            || ($user->role === 'supervisor' && ((int) $order->supervisor_id === (int) $user->id || (int) $order->creator_id === (int) $user->id));
        if (! $canCancel) {
            return response()->json(['message' => 'Only the owning supervisor or an admin can cancel this order'], 403);
        }
        if ($order->status === 'cancelled') {
            return response()->json(['message' => 'Order is already cancelled'], 422);
        }

        $data = $request->validate([
            'type' => 'required|in:full,partial',
            'item_ids' => 'required_if:type,partial|array',
            'item_ids.*' => 'integer|exists:order_items,id',
            'reason' => 'nullable|string|max:2000',
        ]);

        return DB::transaction(function () use ($order, $user, $data) {
            $locked = Order::query()
                ->lockForUpdate()
                ->with(['items', 'client:id,name', 'task:id,order_id,customer_name'])
                ->find($order->id);
            if (! $locked) {
                return response()->json(['message' => 'Order no longer exists'], 410);
            }
            if ($locked->status === 'cancelled') {
                return response()->json(['message' => 'Order is already cancelled'], 422);
            }

            $activeItems = $locked->items->filter(fn (OrderItem $item) => ! $item->is_cancelled)->values();
            if ($activeItems->isEmpty()) {
                return response()->json(['message' => 'There are no active items left to cancel'], 422);
            }

            $type = (string) $data['type'];
            $selectedIds = $type === 'full'
                ? $activeItems->pluck('id')->map(fn ($id) => (int) $id)->all()
                : array_values(array_unique(array_map('intval', $data['item_ids'] ?? [])));

            $selected = $activeItems->filter(fn (OrderItem $item) => in_array((int) $item->id, $selectedIds, true))->values();
            if ($selected->isEmpty()) {
                return response()->json(['message' => 'Select at least one active order item to cancel'], 422);
            }
            if ($type === 'partial' && $selected->count() !== count($selectedIds)) {
                return response()->json(['message' => 'Some selected items are not active on this order'], 422);
            }

            $oldTotal = $locked->total_amount !== null
                ? (float) $locked->total_amount
                : round((float) $activeItems->sum(fn (OrderItem $item) => (float) ($item->line_total ?? 0)), 2);
            $selectedAmount = round((float) $selected->sum(fn (OrderItem $item) => (float) ($item->line_total ?? 0)), 2);
            $remainingActiveCount = $activeItems->count() - $selected->count();
            $isFullCancellation = $type === 'full' || $remainingActiveCount < 1 || $selectedAmount >= $oldTotal - 0.009;
            $cancelledNow = $isFullCancellation ? $oldTotal : min($oldTotal, $selectedAmount);
            $newTotal = $isFullCancellation ? 0.0 : round(max(0, $oldTotal - $cancelledNow), 2);

            $now = now();
            foreach ($selected as $item) {
                $item->is_cancelled = true;
                $item->cancelled_amount = $isFullCancellation && $selected->count() === 1
                    ? $cancelledNow
                    : round((float) ($item->line_total ?? 0), 2);
                $item->cancelled_at = $now;
                $item->cancelled_by = $user->id;
                $item->cancellation_reason = $data['reason'] ?? null;
                $item->save();
            }

            $oldPaid = round((float) ($locked->amount_paid ?? 0), 2);
            $newPaid = round(min($oldPaid, $newTotal), 2);
            $refundNow = round(max(0, $oldPaid - $newPaid), 2);

            if ($refundNow > 0.009 && Schema::hasTable('order_payments')) {
                OrderPayment::create([
                    'order_id' => $locked->id,
                    'amount' => -$refundNow,
                    'paid_at' => $now,
                    'recorded_by' => $user->id,
                    'note' => ($isFullCancellation ? 'Full order refund' : 'Partial order refund')
                        . (! empty($data['reason']) ? ': '.$data['reason'] : ''),
                ]);
            }

            $locked->total_amount = $newTotal;
            $locked->amount_paid = $newPaid;
            $locked->status = $isFullCancellation ? 'cancelled' : $locked->status;
            $locked->payment_due_at = $isFullCancellation || max(0, $newTotal - $newPaid) <= 0.009
                ? null
                : $locked->payment_due_at;
            $locked->cancellation_type = $isFullCancellation ? 'full' : 'partial';
            $locked->cancelled_at = $now;
            $locked->cancelled_by = $user->id;
            $locked->cancellation_reason = $data['reason'] ?? null;
            $locked->cancelled_amount = round((float) ($locked->cancelled_amount ?? 0) + $cancelledNow, 2);
            $locked->refunded_amount = round((float) ($locked->refunded_amount ?? 0) + $refundNow, 2);
            $locked->save();

            $this->syncLinkedCustomerInvoicesAfterCancellation($locked, $cancelledNow, $isFullCancellation, $data['reason'] ?? null);
            $this->syncOrderRefundTransaction($locked, $user);

            $locked->load(['items.profile.category', 'items.color', 'creator:id,name', 'supervisor:id,name', 'client:id,name,phone,email', 'task:id,title,order_id,customer_name,client_id', 'cancelledBy:id,name']);

            return response()->json($this->orderToArray($locked->fresh()));
        });
    }

    private function userCanViewOrder(User $user, Order $order): bool
    {
        if ($user->role === 'admin' || $user->isAccountant()) {
            return true;
        }
        if ($user->role === 'supervisor') {
            return (int) $order->supervisor_id === (int) $user->id || (int) $order->creator_id === (int) $user->id;
        }

        return (int) $order->creator_id === (int) $user->id;
    }

    private function syncLinkedCustomerInvoicesAfterCancellation(Order $order, float $cancelledNow, bool $isFullCancellation, ?string $reason): void
    {
        $invoices = CustomerInvoice::query()->where('order_id', $order->id)->get();
        foreach ($invoices as $invoice) {
            if ($isFullCancellation) {
                $invoice->paid = 0;
                $invoice->balance = 0;
                $invoice->status = CustomerInvoice::STATUS_CANCELLED;
            } else {
                $newTotal = round(max(0, (float) $invoice->total - $cancelledNow), 2);
                $vatRate = (float) ($invoice->vat_rate ?? 0);
                $subtotal = $vatRate > 0 ? round($newTotal / (1 + ($vatRate / 100)), 2) : $newTotal;
                $invoice->subtotal = $subtotal;
                $invoice->vat_amount = round(max(0, $newTotal - $subtotal), 2);
                $invoice->total = $newTotal;
                $invoice->paid = round(min((float) $invoice->paid, $newTotal), 2);
                $invoice->balance = round(max(0, $newTotal - (float) $invoice->paid), 2);
                $invoice->status = $invoice->balance <= 0.009
                    ? CustomerInvoice::STATUS_PAID
                    : CustomerInvoice::STATUS_PARTIAL;
            }
            $note = ($isFullCancellation ? 'Order fully cancelled' : 'Order partially cancelled')
                . ($reason ? ': '.$reason : '');
            $invoice->notes = trim((string) $invoice->notes) !== ''
                ? trim((string) $invoice->notes)."\n".$note
                : $note;
            $invoice->save();
        }
    }

    private function syncOrderRefundTransaction(Order $order, User $user): void
    {
        $refunded = round((float) ($order->refunded_amount ?? 0), 2);
        if ($refunded <= 0.009) {
            return;
        }

        FinanceTransaction::updateOrCreate(
            ['ref_type' => 'order_cancellation', 'ref_id' => $order->id, 'type' => FinanceTransaction::TYPE_PAYMENT],
            [
                'source' => 'customer_refund',
                'party_type' => 'client',
                'party_id' => $order->client_id,
                'party_name' => $order->client?->name ?? $order->task?->customer_name ?? $order->customer_reference,
                'amount' => $refunded,
                'method' => 'refund',
                'reference_no' => $order->receipt_number ? 'REF-'.$order->receipt_number : 'REF-ORD-'.$order->id,
                'date' => now()->toDateString(),
                'notes' => $order->cancellation_reason,
                'status' => 'completed',
                'created_by' => $user->id,
            ]
        );
    }

    private function orderToArray(Order $order): array
    {
        $order->loadMissing(['task:id,title,order_id,customer_name,client_id', 'items.profile.category', 'client:id,name,phone,email', 'cancelledBy:id,name']);

        $total = $order->total_amount !== null ? (float) $order->total_amount : null;
        $paid = $order->amount_paid !== null ? (float) $order->amount_paid : null;
        $paymentStatus = Order::derivePaymentStatus($total, $paid);

        return [
            'id' => (string) $order->id,
            'creatorId' => (string) $order->creator_id,
            'creatorName' => $order->creator?->name,
            'supervisorId' => $order->supervisor_id ? (string) $order->supervisor_id : null,
            'supervisorName' => $order->supervisor?->name,
            'status' => $order->status,
            'customerReference' => $order->customer_reference,
            'totalAmount' => $total,
            'amountPaid' => $paid,
            'balanceDue' => $total !== null ? round(max(0, $total - ($paid ?? 0)), 2) : null,
            'paymentStatus' => $paymentStatus,
            'paymentDueAt' => $order->payment_due_at?->toDateString(),
            'paymentNotes' => $order->payment_notes,
            'currency' => $order->currency ?? 'ILS',
            'receiptNumber' => $order->receipt_number,
            'cancellationType' => $order->cancellation_type,
            'cancelledAt' => $order->cancelled_at?->toISOString(),
            'cancelledById' => $order->cancelled_by ? (string) $order->cancelled_by : null,
            'cancelledByName' => $order->cancelledBy?->name,
            'cancellationReason' => $order->cancellation_reason,
            'cancelledAmount' => round((float) ($order->cancelled_amount ?? 0), 2),
            'refundedAmount' => round((float) ($order->refunded_amount ?? 0), 2),
            'clientId' => $order->client_id ? (string) $order->client_id : null,
            'clientName' => $order->client?->name,
            'clientPhone' => $order->client?->phone,
            'taskId' => $order->task ? (string) $order->task->id : null,
            'taskTitle' => $order->task?->title,
            'taskCustomerName' => $order->task?->customer_name,
            'items' => $order->items->map(fn ($i) => [
                'id' => (string) $i->id,
                'profileId' => (string) $i->profile_id,
                'profileCode' => $i->profile?->profile_id,
                'profileName' => $i->profile?->name,
                'categoryCode' => $i->profile?->category_code,
                'categoryName' => $i->profile?->category?->category_name,
                'colorCode' => $i->color_code,
                'colorName' => $i->color?->name,
                'quantity' => (int) $i->quantity,
                'notes' => $i->notes,
                'unitPrice' => $i->unit_price !== null ? (float) $i->unit_price : null,
                'lineTotal' => $i->line_total !== null ? (float) $i->line_total : null,
                'isCancelled' => (bool) ($i->is_cancelled ?? false),
                'cancelledAmount' => round((float) ($i->cancelled_amount ?? 0), 2),
                'cancelledAt' => $i->cancelled_at?->toISOString(),
                'cancellationReason' => $i->cancellation_reason,
            ])->values()->toArray(),
            'createdAt' => $order->created_at->toISOString(),
            'updatedAt' => $order->updated_at->toISOString(),
        ];
    }
}
