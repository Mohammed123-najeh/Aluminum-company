<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\Order;
use App\Models\Message;
use App\Models\Task;
use App\Models\TaskAttachment;
use App\Models\User;
use App\Services\FinalizeDraftOrderForCompletedTask;
use App\Services\InAppNotifier;
use Illuminate\Http\Request;
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

        $task = Task::create([
            'supervisor_id' => $user->id,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'due_date' => $data['due_date'] ?? null,
            'order_reference' => $data['order_reference'] ?? null,
            'customer_name' => $data['customer_name'] ?? null,
            'order_id' => $data['order_id'] ?? null,
            'status' => Task::STATUS_PENDING,
        ]);

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

    private function taskToArray(Task $task): array
    {
        $task->loadMissing(['assignees:id,name,email', 'client:id,name,phone,email', 'attachments', 'order.items.profile.category', 'order.items.color']);
        $order = $task->order;
        $orderArray = null;
        if ($order) {
            $order->loadMissing(['items.profile.category', 'items.color']);
            $orderArray = [
                'id' => (string) $order->id,
                'status' => $order->status,
                'customerReference' => $order->customer_reference,
                'items' => $order->items->map(fn ($i) => [
                    'profileCode' => $i->profile?->profile_id,
                    'profileName' => $i->profile?->name,
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
