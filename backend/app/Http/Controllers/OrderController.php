<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderPayment;
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
                ->filter(fn (Order $o) => $o->status === 'completed' && $o->receipt_number !== null)
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
        $can = $order->creator_id == $user->id
            || ($user->role === 'supervisor' && (int) $order->supervisor_id === (int) $user->id)
            || $user->role === 'admin'
            || $user->isAccountant();
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
        $can = $order->creator_id == $user->id
            || ($user->role === 'supervisor' && (int) $order->supervisor_id === (int) $user->id)
            || $user->role === 'admin'
            || $user->isAccountant();
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

        return DB::transaction(function () use ($order, $add, $paidAt, $data, $user) {
            OrderPayment::create([
                'order_id' => $order->id,
                'amount' => $add,
                'paid_at' => $paidAt,
                'recorded_by' => $user->id,
                'note' => $data['note'] ?? null,
            ]);
            $order->amount_paid = round((float) ($order->amount_paid ?? 0) + $add, 2);
            $order->save();
            $order->load(['items.profile.category', 'items.color', 'creator:id,name', 'supervisor:id,name', 'client:id,name,phone,email', 'task:id,title,order_id,customer_name,client_id']);

            return response()->json($this->orderToArray($order->fresh()));
        });
    }

    public function updateReceiptMeta(Request $request, Order $order)
    {
        $user = $request->user();
        $can = $order->creator_id == $user->id
            || ($user->role === 'supervisor' && (int) $order->supervisor_id === (int) $user->id)
            || $user->role === 'admin'
            || $user->isAccountant();
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

    private function orderToArray(Order $order): array
    {
        $order->loadMissing(['task:id,title,order_id,customer_name,client_id', 'items.profile.category', 'client:id,name,phone,email']);

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
            ])->values()->toArray(),
            'createdAt' => $order->created_at->toISOString(),
            'updatedAt' => $order->updated_at->toISOString(),
        ];
    }
}
