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
                if (! in_array($otherId, $subordinateIds)) {
                    return response()->json(['message' => 'You can only view threads with your employees'], 403);
                }
            }
            if ($user->role === 'employee' && $user->supervisor_id != $otherId) {
                return response()->json(['message' => 'You can only view threads with your supervisor'], 403);
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
        } else {
            // List: supervisor = sent thread summaries; employee = inbox thread summaries
            if ($user->role === 'supervisor') {
                $latest = Message::where('sender_id', $user->id)
                    ->orderBy('created_at', 'desc')
                    ->get()
                    ->unique('receiver_id')
                    ->values();
                $latest->load('receiver:id,name');
                $result = $latest->map(function ($m) {
                    return [
                        'id' => (string) $m->id,
                        'receiverId' => (string) $m->receiver_id,
                        'receiverName' => $m->receiver->name ?? null,
                        'lastPreview' => \Str::limit($m->body, 80),
                        'lastAt' => $m->created_at->toISOString(),
                    ];
                });
                return response()->json($result);
            }
            if ($user->role === 'employee') {
                $latest = Message::where('receiver_id', $user->id)
                    ->orderBy('created_at', 'desc')
                    ->get()
                    ->unique('sender_id')
                    ->values();
                $latest->load('sender:id,name');
                $result = $latest->map(function ($m) {
                    return [
                        'id' => (string) $m->id,
                        'senderId' => (string) $m->sender_id,
                        'senderName' => $m->sender->name ?? null,
                        'lastPreview' => \Str::limit($m->body, 80),
                        'lastAt' => $m->created_at->toISOString(),
                    ];
                });
                return response()->json($result);
            }
            if ($user->role === 'admin') {
                $rows = Message::query()
                    ->where(function ($q) use ($user) {
                        $q->where('sender_id', $user->id)->orWhere('receiver_id', $user->id);
                    })
                    ->with(['sender:id,name,role', 'receiver:id,name,role'])
                    ->orderBy('created_at', 'desc')
                    ->get();

                $seen = [];
                $result = [];
                foreach ($rows as $m) {
                    $peerId = (int) $m->sender_id === (int) $user->id ? (int) $m->receiver_id : (int) $m->sender_id;
                    if (isset($seen[$peerId])) {
                        continue;
                    }
                    $peer = $peerId === (int) $m->sender_id ? $m->sender : $m->receiver;
                    if (! $peer || $peer->role === 'admin') {
                        continue;
                    }
                    $seen[$peerId] = true;
                    $result[] = [
                        'id' => (string) $m->id,
                        'receiverId' => (string) $peerId,
                        'receiverName' => $peer->name ?? null,
                        'lastPreview' => \Str::limit($m->body, 80),
                        'lastAt' => $m->created_at->toISOString(),
                    ];
                }

                return response()->json($result);
            }
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $result = $messages->map(fn ($m) => $this->messageToArray($m));

        return response()->json($result);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'receiver_id' => 'required|exists:users,id',
            'body' => 'required|string|max:10000',
            'task_id' => 'nullable|exists:tasks,id',
        ]);

        $receiver = User::findOrFail($data['receiver_id']);

        if ($user->role === 'supervisor') {
            if ($receiver->supervisor_id != $user->id) {
                return response()->json(['message' => 'You can only send messages to your own employees'], 403);
            }
        } elseif ($user->role === 'employee') {
            if ((int) $receiver->id !== (int) $user->supervisor_id) {
                return response()->json(['message' => 'You can only reply to your supervisor'], 403);
            }
        } elseif ($user->role === 'admin') {
            if ($receiver->role === 'admin') {
                return response()->json(['message' => 'You cannot message other administrators'], 403);
            }
            if ($receiver->status === 'suspended') {
                return response()->json(['message' => 'Cannot message suspended users'], 403);
            }
        } else {
            return response()->json(['message' => 'You cannot send messages'], 403);
        }

        $taskId = $data['task_id'] ?? null;
        if ($taskId) {
            $task = Task::find($taskId);
            if (! $task) {
                return response()->json(['message' => 'Task not found'], 404);
            }
            if ($user->role === 'supervisor') {
                if ((int) $task->supervisor_id !== (int) $user->id) {
                    return response()->json(['message' => 'You can only reference your own tasks'], 403);
                }
                if (! $task->assignees()->where('user_id', $receiver->id)->exists()) {
                    return response()->json(['message' => 'That task is not assigned to this employee'], 403);
                }
            } elseif ($user->role === 'employee') {
                if (! $task->assignees()->where('user_id', $user->id)->exists()) {
                    return response()->json(['message' => 'You can only reference tasks assigned to you'], 403);
                }
            } elseif ($user->role === 'admin') {
                if (! $task->assignees()->where('user_id', $receiver->id)->exists()) {
                    return response()->json(['message' => 'Task is not assigned to this recipient'], 403);
                }
            }
        }

        $message = Message::create([
            'sender_id' => $user->id,
            'receiver_id' => $receiver->id,
            'body' => $data['body'],
            'task_id' => $taskId,
        ]);

        $message->load('sender:id,name', 'receiver:id,name', 'task:id,title');
        InAppNotifier::messageReceived($receiver, $message->fresh());

        return response()->json($this->messageToArray($message->fresh()), 201);
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
