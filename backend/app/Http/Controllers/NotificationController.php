<?php

namespace App\Http\Controllers;

use App\Models\UserNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    private const PAGE_SIZE = 50;

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $q = UserNotification::query()->where('user_id', $user->id)->orderByDesc('created_at');

        if ($request->boolean('unread_only')) {
            $q->whereNull('read_at');
        }

        $rows = $q->limit(self::PAGE_SIZE)->get();

        return response()->json($rows->map(fn ($n) => $n->toApiArray())->values()->all());
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $user = $request->user();
        $count = UserNotification::query()
            ->where('user_id', $user->id)
            ->whereNull('read_at')
            ->count();

        return response()->json(['count' => $count]);
    }

    public function markRead(Request $request, UserNotification $notification): JsonResponse
    {
        $user = $request->user();
        if ((int) $notification->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $notification->markRead();

        return response()->json($notification->fresh()->toApiArray());
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $user = $request->user();
        UserNotification::query()
            ->where('user_id', $user->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['ok' => true]);
    }
}
