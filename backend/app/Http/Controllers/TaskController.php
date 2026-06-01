<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\Order;
use App\Models\OrderPayment;
use App\Models\Message;
use App\Models\Task;
use App\Models\TaskAttachment;
use App\Models\User;
use App\Services\FinalizeDraftOrderForCompletedTask;
use App\Services\InAppNotifier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class TaskController extends Controller
{
    private const ALLOWED_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];

    public function index(Request $request)
    {
        $user = $request->user();
        $query = Task::with('assignees:id,name,email');

        if ($user->role === 'supervisor') {
            $query->where('supervisor_id', $user->id);
        } else {
            // Employee: only tasks they're assigned to
            $query->whereHas('assignees', fn ($q) => $q->where('user_id', $user->id));
        }

        $assigneeId = $request->query('assignee_id');
        if ($assigneeId) {
            $query->whereHas('assignees', fn ($q) => $q->where('user_id', $assigneeId));
        }
        $status = $request->query('status');
        if ($status && in_array($status, self::ALLOWED_STATUSES)) {
            $query->where('status', $status);
        }

        $tasks = $query->with('order.items.profile.category', 'order.items.color', 'attachments')->orderBy('updated_at', 'desc')->get();

        $result = $tasks->map(fn ($t) => $this->taskToArray($t));
        return response()->json($result);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'supervisor') {
            return response()->json(['message' => 'Only supervisors can create tasks'], 403);
        }

        $data = $request->validate([
            'assignee_ids' => 'required|array',
            'assignee_ids.*' => 'exists:users,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:10000',
            'due_date' => 'nullable|date',
            'order_reference' => 'nullable|string|max:255',
            'customer_name' => 'nullable|string|max:255',
            'customer_phone' => 'nullable|string|max:64',
            'client_id' => 'nullable|exists:clients,id',
            'order_id' => 'nullable|exists:orders,id',
            'total_amount' => 'nullable|numeric|min:0',
            'amount_paid' => 'nullable|numeric|min:0',
        ]);

        if (! empty($data['client_id'])) {
            $this->assertClientBelongsToSupervisor((int) $data['client_id'], $user);
        }

        $subordinateIds = $user->subordinates()->pluck('id')->toArray();
        foreach ($data['assignee_ids'] as $id) {
            if (! in_array((int) $id, $subordinateIds)) {
                return response()->json(['message' => 'All assignees must be your employees'], 403);
            }
        }

        if (! empty($data['order_id'])) {
            $order = Order::find($data['order_id']);
            if (! $order || ($order->supervisor_id != $user->id && $order->creator_id != $user->id)) {
                return response()->json(['message' => 'Order not found or you do not own it'], 403);
            }
        }

        $totalAmount = isset($data['total_amount']) ? (float) $data['total_amount'] : null;
        $amountPaid = isset($data['amount_paid']) ? (float) $data['amount_paid'] : null;

        // If the supervisor entered a total but didn't pick an existing order, mint one so the
        // task's money side flows through the accountant's normal Orders + Receipts pipeline.
        $orderId = $data['order_id'] ?? null;
        if (!$orderId && $totalAmount !== null && $totalAmount > 0) {
            $newOrder = Order::create([
                'creator_id' => $user->id,
                'supervisor_id' => $user->id,
                'client_id' => $data['client_id'] ?? null,
                'status' => 'draft',
                'customer_reference' => $data['customer_name'] ?? null,
                'total_amount' => $totalAmount,
                'amount_paid' => $amountPaid ?? 0,
                'currency' => 'ILS',
            ]);
            $orderId = $newOrder->id;
        }

        $task = Task::create([
            'supervisor_id' => $user->id,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'due_date' => $data['due_date'] ?? null,
            'order_reference' => $data['order_reference'] ?? null,
            'customer_name' => $data['customer_name'] ?? null,
            'customer_phone' => $data['customer_phone'] ?? null,
            'client_id' => $data['client_id'] ?? null,
            'order_id' => $orderId,
            'status' => Task::STATUS_PENDING,
        ]);

        // If this task is attached to an existing order, propagate the client_id onto the order so
        // the client section aggregates correctly when payments are added later. Overwrite any
        // prior value too, otherwise re-linking the task to a different client never reaches
        // the order and the new client keeps showing zero totals. Also let supervisors top-up
        // the totals on an already-linked order through the same form.
        if (!empty($orderId)) {
            $updates = [];
            if (!empty($data['client_id'])) $updates['client_id'] = $data['client_id'];
            if ($totalAmount !== null) $updates['total_amount'] = $totalAmount;
            if ($amountPaid !== null) $updates['amount_paid'] = $amountPaid;
            if (!empty($updates)) Order::where('id', $orderId)->update($updates);
        }

        $task->assignees()->sync($data['assignee_ids']);
        $task->load('assignees:id,name,email', 'client:id,name,phone,email', 'order.items.profile', 'order.items.color', 'attachments');

        $supervisorName = $user->name;
        foreach ($task->assignees as $assignee) {
            InAppNotifier::taskAssigned($assignee, $task, $supervisorName);
        }

        return response()->json($this->taskToArray($task->fresh()), 201);
    }

    public function storeAttachment(Request $request, Task $task)
    {
        $user = $request->user();
        if (! $this->userCanAccessTask($user, $task)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'file' => 'required|file|max:5120|mimes:pdf,jpeg,jpg,png',
        ]);

        $uploaded = $request->file('file');
        $path = $uploaded->store('task-attachments', 'public');

        TaskAttachment::create([
            'task_id' => $task->id,
            'user_id' => $user->id,
            'original_name' => $uploaded->getClientOriginalName(),
            'path' => $path,
        ]);

        $task->load('assignees:id,name,email', 'client:id,name,phone,email', 'order.items.profile', 'order.items.color', 'attachments');

        return response()->json($this->taskToArray($task->fresh()), 201);
    }

    public function destroyAttachment(Request $request, Task $task, TaskAttachment $attachment)
    {
        if ((int) $attachment->task_id !== (int) $task->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $user = $request->user();
        if (! $this->userCanAccessTask($user, $task)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (Storage::disk('public')->exists($attachment->path)) {
            Storage::disk('public')->delete($attachment->path);
        }
        $attachment->delete();

        $task->load('assignees:id,name,email', 'client:id,name,phone,email', 'order.items.profile', 'order.items.color', 'attachments');

        return response()->json($this->taskToArray($task->fresh()));
    }

    public function update(Request $request, Task $task)
    {
        $user = $request->user();
        $isSupervisor = $task->supervisor_id == $user->id;
        $isAssignee = $task->assignees()->where('user_id', $user->id)->exists();

        if (! $isSupervisor && ! $isAssignee) {
            return response()->json(['message' => 'You can only update your own tasks or tasks assigned to you'], 403);
        }

        $prevStatus = $task->status;

        if ($isSupervisor) {
            $data = $request->validate([
                'title' => 'sometimes|string|max:255',
                'description' => 'nullable|string|max:10000',
                'status' => 'sometimes|in:' . implode(',', self::ALLOWED_STATUSES),
                'due_date' => 'nullable|date',
                'order_reference' => 'nullable|string|max:255',
                'customer_name' => 'nullable|string|max:255',
                'customer_phone' => 'nullable|string|max:64',
                'client_id' => 'nullable|exists:clients,id',
                'order_id' => 'nullable|exists:orders,id',
                'assignee_ids' => 'sometimes|array',
                'assignee_ids.*' => 'exists:users,id',
            ]);

            if (array_key_exists('client_id', $data) && $data['client_id'] !== null) {
                $this->assertClientBelongsToSupervisor((int) $data['client_id'], $user);
            }

            if (isset($data['title'])) {
                $task->title = $data['title'];
            }
            if (array_key_exists('description', $data)) {
                $task->description = $data['description'];
            }
            if (isset($data['status'])) {
                $newStatus = $data['status'];
                if ($newStatus === Task::STATUS_COMPLETED && $task->status !== Task::STATUS_COMPLETED) {
                    $task->completed_at = now();
                } elseif ($newStatus !== Task::STATUS_COMPLETED) {
                    $task->completed_at = null;
                }
                $task->status = $newStatus;
            }
            if (array_key_exists('due_date', $data)) {
                $task->due_date = $data['due_date'];
            }
            if (array_key_exists('order_reference', $data)) {
                $task->order_reference = $data['order_reference'];
            }
            if (array_key_exists('customer_name', $data)) {
                $task->customer_name = $data['customer_name'];
            }
            if (array_key_exists('customer_phone', $data)) {
                $task->customer_phone = $data['customer_phone'];
            }
            if (array_key_exists('client_id', $data)) {
                $task->client_id = $data['client_id'];
            }
            if (array_key_exists('order_id', $data)) {
                $task->order_id = $data['order_id'];
            }
            // Propagate the task's client to its linked order so the Clients section aggregates
            // payments correctly. Always overwrite — when the supervisor re-links the task to a
            // different client, the order must follow.
            $linkedOrderId = $task->order_id;
            if ($linkedOrderId && $task->client_id) {
                Order::where('id', $linkedOrderId)
                    ->update(['client_id' => $task->client_id]);
            }
            if (isset($data['assignee_ids'])) {
                $subordinateIds = $user->subordinates()->pluck('id')->toArray();
                foreach ($data['assignee_ids'] as $id) {
                    if (! in_array((int) $id, $subordinateIds)) {
                        return response()->json(['message' => 'All assignees must be your employees'], 403);
                    }
                }
                $task->assignees()->sync($data['assignee_ids']);
            }
            $task->save();

            if (isset($data['status']) && $data['status'] === Task::STATUS_CANCELLED && $prevStatus !== Task::STATUS_CANCELLED) {
                $task->load('assignees:id,name,email');
                $body = 'Task #'.$task->id.' was cancelled by your supervisor. You do not need to work on it.';
                foreach ($task->assignees as $assignee) {
                    InAppNotifier::taskCancelledBySupervisor($assignee, $task);
                    Message::create([
                        'sender_id' => $user->id,
                        'receiver_id' => $assignee->id,
                        'body' => $body,
                        'task_id' => $task->id,
                    ]);
                }
            }
        } else {
            // Assignee: only in_progress and completed
            $data = $request->validate([
                'status' => 'required|in:in_progress,completed',
            ]);
            $newStatus = $data['status'];
            if ($newStatus === Task::STATUS_COMPLETED && $task->status !== Task::STATUS_COMPLETED) {
                $task->completed_at = now();
            } elseif ($newStatus !== Task::STATUS_COMPLETED) {
                $task->completed_at = null;
            }
            $task->status = $newStatus;
            $task->save();

            if ($prevStatus !== $newStatus) {
                $supervisor = User::find($task->supervisor_id);
                if ($supervisor) {
                    InAppNotifier::taskStatusForSupervisor($supervisor, $task->fresh(), $user, $newStatus);
                }
            }
        }

        if ($task->status === Task::STATUS_COMPLETED && $task->order_id) {
            app(FinalizeDraftOrderForCompletedTask::class)->finalize($task);
        }

        $task->load('assignees:id,name,email', 'client:id,name,phone,email', 'order.items.profile.category', 'order.items.color', 'attachments');
        return response()->json($this->taskToArray($task->fresh()));
    }

    public function destroy(Request $request, Task $task)
    {
        $user = $request->user();
        if ($user->role !== 'supervisor' || (int) $task->supervisor_id !== (int) $user->id) {
            return response()->json(['message' => 'Only the owning supervisor can delete this task'], 403);
        }
        $task->delete();

        return response()->json(null, 204);
    }

    private function userCanAccessTask(User $user, Task $task): bool
    {
        if ((int) $task->supervisor_id === (int) $user->id) {
            return true;
        }

        return $task->assignees()->where('user_id', $user->id)->exists();
    }

    private function assertClientBelongsToSupervisor(int $clientId, User $supervisor): void
    {
        $client = Client::query()->find($clientId);
        if (! $client || (int) $client->supervisor_id !== (int) $supervisor->id) {
            abort(response()->json(['message' => 'Client not found or not in your list'], 403));
        }
    }

    /**
     * Cancel a task. Only the owning supervisor (or admin) may call this.
     *
     * Side effects, all inside a single transaction:
     * - status set to "cancelled", cancelled_at/reason recorded.
     * - linked Order, if present:
     *     * if it had a paid amount, a negative OrderPayment row is inserted
     *       (acts as a refund record on the audit trail) and amount_paid is
     *       zeroed out.
     *     * Order.status flipped to "cancelled" so client outstanding-debt
     *       aggregates drop it immediately (ClientController already filters
     *       out cancelled orders).
     * - notifies every assignee (so they stop working on it).
     * - notifies every HR and Finance employee (so they see refunds + history).
     *
     * Refuses to cancel tasks already in a terminal state.
     */
    public function cancel(Request $request, Task $task)
    {
        $user = $request->user();
        $isOwner = $user->role === 'supervisor' && (int) $task->supervisor_id === (int) $user->id;
        $isAdmin = $user->role === 'admin';
        if (! $isOwner && ! $isAdmin) {
            return response()->json(['message' => 'Only the owning supervisor or an admin can cancel this task'], 403);
        }
        if ($task->status === Task::STATUS_COMPLETED) {
            return response()->json(['message' => 'A completed task cannot be cancelled'], 422);
        }
        if ($task->status === Task::STATUS_CANCELLED) {
            return response()->json(['message' => 'Task is already cancelled'], 422);
        }

        $data = $request->validate([
            'reason' => 'nullable|string|max:2000',
        ]);

        return DB::transaction(function () use ($task, $user, $data) {
            // Re-fetch the task with a row lock so two simultaneous cancels can't
            // both pass the status check + both create refund rows. The earlier
            // status validation outside the transaction was a fast-path; this
            // is the authoritative check.
            $locked = Task::query()->lockForUpdate()->find($task->id);
            if (! $locked) {
                return response()->json(['message' => 'Task no longer exists'], 410);
            }
            if ($locked->status === Task::STATUS_COMPLETED || $locked->status === Task::STATUS_CANCELLED) {
                return response()->json(['message' => 'Task is already in a terminal state'], 422);
            }
            $task = $locked;

            $refundedAmount = 0.0;

            if ($task->order_id) {
                /** @var Order|null $order */
                $order = Order::query()->lockForUpdate()->find($task->order_id);
                if ($order) {
                    $paid = (float) ($order->amount_paid ?? 0);
                    if ($paid > 0.009 && Schema::hasTable('order_payments')) {
                        OrderPayment::create([
                            'order_id' => $order->id,
                            'amount' => -round($paid, 2),
                            'paid_at' => now(),
                            'recorded_by' => $user->id,
                            'note' => 'Refund — task cancelled' . (! empty($data['reason']) ? ': ' . $data['reason'] : ''),
                        ]);
                        $refundedAmount = round($paid, 2);
                    }
                    $order->amount_paid = 0;
                    $order->status = 'cancelled';
                    $order->save();
                }
            }

            $task->status = Task::STATUS_CANCELLED;
            $task->cancelled_at = now();
            $task->cancellation_reason = $data['reason'] ?? null;
            $task->save();

            // Notify assignees so they stop working on it. Reuse the existing
            // notifier + a Message row so the cancel reason appears in their inbox.
            $task->load('assignees:id,name,email');
            $assigneeBody = 'Task #' . $task->id . ' (' . $task->title . ') was cancelled.';
            if (! empty($data['reason'])) {
                $assigneeBody .= ' Reason: ' . $data['reason'];
            }
            if ($refundedAmount > 0) {
                $assigneeBody .= ' (Customer refund: ' . number_format($refundedAmount, 2) . ' ILS)';
            }
            foreach ($task->assignees as $assignee) {
                InAppNotifier::taskCancelledBySupervisor($assignee, $task);
                Message::create([
                    'sender_id' => $user->id,
                    'receiver_id' => $assignee->id,
                    'body' => $assigneeBody,
                    'task_id' => $task->id,
                ]);
            }

            // Notify HR + Finance so they have a refund audit trail.
            $staff = User::query()
                ->where('role', 'employee')
                ->whereIn('employee_type', ['hr', 'accountant'])
                ->where('status', 'active')
                ->get();
            $staffBody = 'Task #' . $task->id . ' (' . $task->title . ') was cancelled by ' . $user->name . '.';
            if ($refundedAmount > 0) {
                $staffBody .= ' Customer refund: ' . number_format($refundedAmount, 2) . ' ILS.';
            }
            if (! empty($data['reason'])) {
                $staffBody .= ' Reason: ' . $data['reason'];
            }
            foreach ($staff as $staffMember) {
                // Staff-specific copy (the supervisor's "you do not need to work on it"
                // line doesn't apply to HR/Finance — they're observers).
                InAppNotifier::taskCancelledForStaff($staffMember, $task, $refundedAmount);
                // Also drop a message in their inbox so the audit is visible alongside the bell.
                Message::create([
                    'sender_id' => $user->id,
                    'receiver_id' => $staffMember->id,
                    'body' => $staffBody,
                    'task_id' => $task->id,
                ]);
            }

            $task->refresh();
            return response()->json([
                'task' => $this->taskToArray($task),
                'refundedAmount' => $refundedAmount,
            ]);
        });
    }

    private function taskToArray(Task $task): array
    {
        $task->loadMissing(['assignees:id,name,email', 'client:id,name,phone,email', 'attachments', 'order.items.profile.category', 'order.items.color']);
        $order = $task->order;
        $orderArray = null;
        if ($order) {
            $order->loadMissing(['items.profile.category', 'items.color']);
            $total = $order->total_amount !== null ? (float) $order->total_amount : null;
            $paid = $order->amount_paid !== null ? (float) $order->amount_paid : 0.0;
            $orderArray = [
                'id' => (string) $order->id,
                'status' => $order->status,
                'customerReference' => $order->customer_reference,
                'totalAmount' => $total,
                'amountPaid' => $paid,
                'balanceDue' => $total !== null ? round(max(0, $total - $paid), 2) : null,
                'paymentStatus' => Order::derivePaymentStatus($total, $paid),
                'items' => $order->items->map(fn ($i) => [
                    'profileCode' => $i->profile?->profile_id,
                    'profileName' => $i->profile?->name,
                    'categoryCode' => $i->profile?->category_code,
                    'categoryName' => $i->profile?->category?->category_name,
                    'colorCode' => $i->color_code,
                    'colorName' => $i->color?->name,
                    'quantity' => (int) $i->quantity,
                ])->values()->toArray(),
            ];
        }

        return [
            'id' => (string) $task->id,
            'supervisorId' => (string) $task->supervisor_id,
            'title' => $task->title,
            'description' => $task->description,
            'status' => $task->status,
            'completedAt' => $task->completed_at?->toISOString(),
            'cancelledAt' => $task->cancelled_at?->toISOString(),
            'cancellationReason' => $task->cancellation_reason,
            'dueDate' => $task->due_date?->format('Y-m-d'),
            'orderReference' => $task->order_reference,
            'customerName' => $task->customer_name,
            'customerPhone' => $task->customer_phone,
            'clientId' => $task->client_id ? (string) $task->client_id : null,
            'clientName' => $task->client?->name,
            'clientPhone' => $task->client?->phone,
            'orderId' => $task->order_id ? (string) $task->order_id : null,
            'order' => $orderArray,
            'attachments' => $task->attachments->map(fn ($a) => [
                'id' => (string) $a->id,
                'name' => $a->original_name,
                'url' => Storage::disk('public')->url($a->path),
            ])->values()->toArray(),
            'assignees' => $task->assignees->map(fn ($u) => [
                'id' => (string) $u->id,
                'name' => $u->name,
                'email' => $u->email,
            ])->values()->toArray(),
            'createdAt' => $task->created_at->toISOString(),
            'updatedAt' => $task->updated_at->toISOString(),
        ];
    }
}
