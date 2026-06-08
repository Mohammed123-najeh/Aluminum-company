<?php

namespace App\Http\Controllers;

use App\Models\Message;
use App\Models\Task;
use App\Models\User;
use App\Services\InAppNotifier;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $receiverId = $request->query('receiver_id');

        if ($receiverId) {
            // Thread: messages between me and this user
            $otherId = (int) $receiverId;
            if ($user->role === 'supervisor') {
                $subordinateIds = $user->subordinates()->pluck('id')->toArray();
                $primaryAdmin = $this->primaryAdmin();
                $isPrimaryAdmin = $primaryAdmin && (int) $primaryAdmin->id === $otherId;
                $other = User::find($otherId);
                $isStaffContact = $other && $other->role === 'employee'
                    && in_array($other->employee_type, ['hr', 'accountant'], true);
                if (! in_array($otherId, $subordinateIds) && ! $isPrimaryAdmin && ! $isStaffContact) {
                    return response()->json(['message' => 'You can only view threads with your team, HR, Finance, or the primary admin'], 403);
                }
            }
            if ($user->role === 'employee') {
                $other = User::find($otherId);
                $isStaff = in_array($user->employee_type, ['hr', 'accountant'], true);
                $allowed = $other && (
                    (int) $other->id === (int) $user->supervisor_id
                    || ($other->role === 'employee' && $other->employee_type === 'hr')
                    || ($other->role === 'employee' && $other->employee_type === 'accountant')
                    || ($other->role === 'employee' && $other->id !== $user->id && (int) $other->supervisor_id === (int) $user->supervisor_id && $user->supervisor_id !== null)
                    // HR / Finance employees can view threads with any supervisor
                    || ($isStaff && $other->role === 'supervisor')
                );
                if (! $allowed) {
                    return response()->json(['message' => 'You can only message your supervisor, HR, Finance, or your teammates'], 403);
                }
            }
            if ($user->role === 'admin') {
                $other = User::find($otherId);
                if (! $other || $other->role === 'admin') {
                    return response()->json(['message' => 'You can only message supervisors and employees'], 403);
                }
            }
            $messages = Message::with(['sender:id,name', 'receiver:id,name', 'task:id,title'])
                ->where(function ($q) use ($user, $otherId) {
                    $q->where('sender_id', $user->id)->where('receiver_id', $otherId)
                        ->orWhere('sender_id', $otherId)->where('receiver_id', $user->id);
                })
                ->orderBy('created_at')
                ->get();

            Message::query()
                ->where('sender_id', $otherId)
                ->where('receiver_id', $user->id)
                ->whereNull('read_at')
                ->update(['read_at' => now()]);
        } else {
            return response()->json($this->threadSummariesFor($user));
        }

        $result = $messages->map(fn ($m) => $this->messageToArray($m));

        return response()->json($result);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'receiver_id' => 'nullable|exists:users,id|required_without:receiver_ids',
            'receiver_ids' => 'nullable|array|required_without:receiver_id',
            'receiver_ids.*' => 'exists:users,id',
            'body' => 'required|string|max:10000',
            'task_id' => 'nullable|exists:tasks,id',
        ]);

        $receiverIds = collect($data['receiver_ids'] ?? [$data['receiver_id']])
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($receiverIds->isEmpty()) {
            return response()->json(['message' => 'Select at least one recipient'], 422);
        }

        $taskId = $data['task_id'] ?? null;
        $messages = [];
        foreach ($receiverIds as $receiverId) {
            $receiver = User::findOrFail($receiverId);
            if (! $this->canMessageReceiver($user, $receiver)) {
                return response()->json(['message' => 'You cannot message one or more selected recipients'], 403);
            }

            $this->assertTaskCanBeReferenced($user, $receiver, $taskId);

            $message = Message::create([
                'sender_id' => $user->id,
                'receiver_id' => $receiver->id,
                'body' => $data['body'],
                'task_id' => $taskId,
            ]);

            $message->load('sender:id,name', 'receiver:id,name', 'task:id,title');
            InAppNotifier::messageReceived($receiver, $message->fresh());
            $messages[] = $this->messageToArray($message->fresh());
        }

        return response()->json(count($messages) === 1 ? $messages[0] : $messages, 201);
    }

    private function assertTaskCanBeReferenced(User $user, User $receiver, mixed $taskId): void
    {
        if (! $taskId) {
            return;
        }

        if ($taskId) {
            $task = Task::find($taskId);
            if (! $task) {
                abort(response()->json(['message' => 'Task not found'], 404));
            }
            if ($user->role === 'supervisor') {
                if ((int) $task->supervisor_id !== (int) $user->id) {
                    abort(response()->json(['message' => 'You can only reference your own tasks'], 403));
                }
                if (! $task->assignees()->where('user_id', $receiver->id)->exists()) {
                    abort(response()->json(['message' => 'That task is not assigned to this employee'], 403));
                }
            } elseif ($user->role === 'employee') {
                if (! $task->assignees()->where('user_id', $user->id)->exists()) {
                    abort(response()->json(['message' => 'You can only reference tasks assigned to you'], 403));
                }
            } elseif ($user->role === 'admin') {
                if (! $task->assignees()->where('user_id', $receiver->id)->exists()) {
                    abort(response()->json(['message' => 'Task is not assigned to this recipient'], 403));
                }
            }
        }
    }

    private function canMessageReceiver(User $user, User $receiver): bool
    {
        if ($receiver->status === 'suspended') {
            return false;
        }
        if ($user->role === 'supervisor') {
            $primaryAdmin = $this->primaryAdmin();
            // Supervisor can message: their own team + the primary admin + any HR
            // employee + any accountant (Finance) employee.
            return (int) $receiver->supervisor_id === (int) $user->id
                || ($primaryAdmin && (int) $receiver->id === (int) $primaryAdmin->id)
                || ($receiver->role === 'employee' && $receiver->employee_type === 'hr')
                || ($receiver->role === 'employee' && $receiver->employee_type === 'accountant');
        }
        if ($user->role === 'employee') {
            // HR and Finance employees can message ANY supervisor (cross-team
            // contact is part of their job). Plain workshop employees stay
            // restricted to their own supervisor.
            $isStaff = in_array($user->employee_type, ['hr', 'accountant'], true);
            if ($isStaff && $receiver->role === 'supervisor') {
                return true;
            }
            return (int) $receiver->id === (int) $user->supervisor_id
                || ($receiver->role === 'employee' && $receiver->employee_type === 'hr')
                || ($receiver->role === 'employee' && $receiver->employee_type === 'accountant')
                || ($receiver->role === 'employee'
                    && (int) $receiver->id !== (int) $user->id
                    && $user->supervisor_id !== null
                    && (int) $receiver->supervisor_id === (int) $user->supervisor_id);
        }
        if ($user->role === 'admin') {
            return $receiver->role !== 'admin';
        }

        return false;
    }

    private function primaryAdmin(): ?User
    {
        return User::query()->where('role', 'admin')->where('status', 'active')->orderBy('id')->first();
    }

    /**
     * GET /messages/contacts
     * Returns people the current user is allowed to message, grouped by relation
     * (HR / supervisor / teammates / team / primary admin).
     */
    public function contacts(Request $request)
    {
        $user = $request->user();

        $hr = User::query()
            ->where('role', 'employee')
            ->where('employee_type', 'hr')
            ->where('status', 'active')
            ->where('id', '!=', $user->id)
            ->orderBy('name')->get();

        $finance = User::query()
            ->where('role', 'employee')
            ->where('employee_type', 'accountant')
            ->where('status', 'active')
            ->where('id', '!=', $user->id)
            ->orderBy('name')->get();

        $contacts = [];

        if ($user->role === 'admin') {
            $rows = User::query()->where('role', '!=', 'admin')->where('status', 'active')->orderBy('name')->get();
            foreach ($rows as $u) $contacts[] = $this->contactRow($u, 'staff');
        } elseif ($user->role === 'supervisor') {
            $admin = $this->primaryAdmin();
            if ($admin) $contacts[] = $this->contactRow($admin, 'admin');
            foreach ($hr as $u) $contacts[] = $this->contactRow($u, 'hr');
            foreach ($finance as $u) $contacts[] = $this->contactRow($u, 'finance');
            // Supervisor's own operational team (exclude cross-functional HR/Finance/Sales
            // employees that happen to be assigned to him for org-chart purposes).
            $team = $user->subordinates()
                ->where('status', 'active')
                ->where(function ($q) {
                    $q->whereNull('employee_type')
                      ->orWhereNotIn('employee_type', ['hr', 'accountant', 'sales']);
                })
                ->orderBy('name')->get();
            foreach ($team as $u) $contacts[] = $this->contactRow($u, 'team');
        } else { // employee
            $isStaff = in_array($user->employee_type, ['hr', 'accountant'], true);
            if ($user->supervisor_id) {
                $sup = User::find($user->supervisor_id);
                if ($sup && $sup->status === 'active') $contacts[] = $this->contactRow($sup, 'supervisor');
                $teammates = User::query()
                    ->where('role', 'employee')
                    ->where('supervisor_id', $user->supervisor_id)
                    ->where('id', '!=', $user->id)
                    ->where('status', 'active')
                    ->orderBy('name')->get();
                foreach ($teammates as $u) $contacts[] = $this->contactRow($u, 'teammate');
            }
            // HR/Finance employees can reach every supervisor, not just their own.
            if ($isStaff) {
                $allSupervisors = User::query()
                    ->where('role', 'supervisor')
                    ->where('status', 'active')
                    ->orderBy('name')->get();
                foreach ($allSupervisors as $sup) {
                    if (! collect($contacts)->pluck('id')->contains((string) $sup->id)) {
                        $contacts[] = $this->contactRow($sup, 'supervisor');
                    }
                }
            }
            foreach ($hr as $u) {
                if (! collect($contacts)->pluck('id')->contains((string) $u->id)) {
                    $contacts[] = $this->contactRow($u, 'hr');
                }
            }
            foreach ($finance as $u) {
                if (! collect($contacts)->pluck('id')->contains((string) $u->id)) {
                    $contacts[] = $this->contactRow($u, 'finance');
                }
            }
        }

        return response()->json($contacts);
    }

    private function contactRow(User $u, string $relation): array
    {
        return [
            'id' => (string) $u->id,
            'name' => $u->name,
            'role' => $u->role,
            'employeeType' => $u->employee_type,
            'mainJob' => $u->main_job,
            'relation' => $relation,
        ];
    }

    private function threadSummariesFor(User $user): array
    {
        $rows = Message::query()
            ->where(function ($q) use ($user) {
                $q->where('sender_id', $user->id)->orWhere('receiver_id', $user->id);
            })
            ->with(['sender:id,name,role', 'receiver:id,name,role'])
            ->orderByDesc('created_at')
            ->get();

        // All unread counts in ONE grouped query (was one COUNT per conversation peer).
        $unreadByPeer = Message::query()
            ->where('receiver_id', $user->id)
            ->whereNull('read_at')
            ->selectRaw('sender_id, COUNT(*) as c')
            ->groupBy('sender_id')
            ->pluck('c', 'sender_id');

        $seen = [];
        $result = [];
        foreach ($rows as $m) {
            $peerId = (int) $m->sender_id === (int) $user->id ? (int) $m->receiver_id : (int) $m->sender_id;
            if (isset($seen[$peerId])) {
                continue;
            }
            $peer = $peerId === (int) $m->sender_id ? $m->sender : $m->receiver;
            if (! $peer) {
                continue;
            }
            $seen[$peerId] = true;
            $unread = (int) ($unreadByPeer[$peerId] ?? 0);
            $result[] = [
                'id' => (string) $m->id,
                'peerId' => (string) $peerId,
                'peerName' => $peer->name,
                'peerRole' => $peer->role,
                'receiverId' => (string) $peerId,
                'receiverName' => $peer->name,
                'senderId' => (string) $peerId,
                'senderName' => $peer->name,
                'lastPreview' => \Str::limit($m->body, 80),
                'lastAt' => $m->created_at->toISOString(),
                'unreadCount' => $unread,
            ];
        }

        return $result;
    }

    private function messageToArray(Message $message): array
    {
        $message->loadMissing('sender:id,name', 'receiver:id,name', 'task:id,title');

        return [
            'id' => (string) $message->id,
            'senderId' => (string) $message->sender_id,
            'senderName' => $message->sender?->name,
            'receiverId' => (string) $message->receiver_id,
            'receiverName' => $message->receiver?->name,
            'body' => $message->body,
            'taskId' => $message->task_id ? (string) $message->task_id : null,
            'taskTitle' => $message->task?->title,
            'readAt' => $message->read_at?->toISOString(),
            'createdAt' => $message->created_at->toISOString(),
        ];
    }
}
