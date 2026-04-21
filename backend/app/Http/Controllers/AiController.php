<?php

namespace App\Http\Controllers;

use App\Models\AiConversation;
use App\Models\AiMessage;
use App\Services\AiContextBuilder;
use App\Services\OpenAiChatService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class AiController extends Controller
{
    private const MAX_MESSAGE_LEN = 4000;

    private const HISTORY_MESSAGE_LIMIT = 40;

    public function taskText(Request $request, OpenAiChatService $openAi): JsonResponse
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['supervisor', 'admin'], true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'field' => 'required|in:title,description',
            'text' => 'required|string|max:8000',
            'mode' => 'required|in:improve,shorten,translate_en,translate_ar',
        ]);

        if (!$openAi->isConfigured()) {
            return response()->json([
                'message' => 'AI is not configured. Set OPENAI_API_KEY in .env',
            ], 503);
        }

        $system = $this->taskTextSystemPrompt($data['field'], $data['mode']);

        try {
            $text = $openAi->chat($system, $data['text']);
        } catch (RuntimeException $e) {
            return response()->json([
                'message' => $e->getMessage() === 'OpenAI request failed'
                    ? 'AI service temporarily unavailable'
                    : $e->getMessage(),
            ], 502);
        }

        if ($text === '') {
            return response()->json(['message' => 'Empty AI response'], 502);
        }

        return response()->json(['text' => $text]);
    }

    public function conversations(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$this->canUseAssistant($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $list = AiConversation::query()
            ->where('user_id', $user->id)
            ->orderByDesc('updated_at')
            ->limit(50)
            ->get(['id', 'title', 'created_at', 'updated_at']);

        return response()->json($list->map(fn ($c) => [
            'id' => (string) $c->id,
            'title' => $c->title ?? 'Chat',
            'createdAt' => $c->created_at->toISOString(),
            'updatedAt' => $c->updated_at->toISOString(),
        ]));
    }

    public function messages(Request $request, AiConversation $conversation): JsonResponse
    {
        $user = $request->user();
        if (!$this->canUseAssistant($user) || (int) $conversation->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $rows = $conversation->messages()->orderBy('id')->get(['id', 'role', 'content', 'created_at']);

        return response()->json([
            'conversationId' => (string) $conversation->id,
            'messages' => $rows->map(fn ($m) => [
                'id' => (string) $m->id,
                'role' => $m->role,
                'content' => $m->content,
                'createdAt' => $m->created_at->toISOString(),
            ]),
        ]);
    }

    public function deleteConversation(Request $request, AiConversation $conversation): JsonResponse
    {
        $user = $request->user();
        if (!$this->canUseAssistant($user) || (int) $conversation->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $conversation->delete();

        return response()->json(null, 204);
    }

    public function shareConversation(Request $request, AiConversation $conversation): JsonResponse
    {
        $user = $request->user();
        if (!$this->canUseAssistant($user) || (int) $conversation->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($conversation->share_token === null) {
            $conversation->share_token = (string) Str::uuid();
            $conversation->save();
        }

        return response()->json([
            'shareToken' => $conversation->share_token,
        ]);
    }

    public function sharedConversation(Request $request, string $token): JsonResponse
    {
        $user = $request->user();
        if (!$this->canUseAssistant($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $conversation = AiConversation::query()
            ->where('share_token', $token)
            ->with([
                'user:id,name,email',
                'messages' => fn ($q) => $q->orderBy('id')->select('id', 'conversation_id', 'role', 'content', 'created_at'),
            ])
            ->first();

        if (!$conversation) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $owner = $conversation->user;

        return response()->json([
            'conversationId' => (string) $conversation->id,
            'title' => $conversation->title ?? 'Chat',
            'ownerName' => $owner?->name ?? 'User',
            'ownerId' => $owner ? (string) $owner->id : null,
            'messages' => $conversation->messages->map(fn ($m) => [
                'id' => (string) $m->id,
                'role' => $m->role,
                'content' => $m->content,
                'createdAt' => $m->created_at->toISOString(),
            ]),
        ]);
    }

    public function importShared(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$this->canUseAssistant($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'share_token' => 'required|uuid',
        ]);

        $source = AiConversation::query()
            ->where('share_token', $data['share_token'])
            ->with([
                'messages' => fn ($q) => $q->orderBy('id')->select('id', 'conversation_id', 'role', 'content', 'created_at'),
            ])
            ->first();

        if (!$source) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $newConversation = DB::transaction(function () use ($user, $source) {
            $base = $source->title ?? 'Chat';
            $copyTitle = 'Copy: ' . $base;
            if (mb_strlen($copyTitle) > 255) {
                $copyTitle = mb_substr($copyTitle, 0, 252) . '…';
            }
            $copy = AiConversation::create([
                'user_id' => $user->id,
                'title' => $copyTitle,
            ]);

            foreach ($source->messages as $m) {
                if (!in_array($m->role, [AiMessage::ROLE_USER, AiMessage::ROLE_ASSISTANT], true)) {
                    continue;
                }
                AiMessage::create([
                    'conversation_id' => $copy->id,
                    'role' => $m->role,
                    'content' => $m->content,
                ]);
            }

            return $copy;
        });

        return response()->json([
            'conversationId' => (string) $newConversation->id,
        ]);
    }

    public function chat(Request $request, OpenAiChatService $openAi, AiContextBuilder $contextBuilder): JsonResponse
    {
        $user = $request->user();
        if (!$this->canUseAssistant($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'conversation_id' => 'nullable|string',
            'message' => 'required|string|max:' . self::MAX_MESSAGE_LEN,
        ]);

        if (!$openAi->isConfigured()) {
            return response()->json([
                'message' => 'AI is not configured. Set OPENAI_API_KEY in .env',
            ], 503);
        }

        $conversation = null;
        if (!empty($data['conversation_id'])) {
            $conversation = AiConversation::query()
                ->where('user_id', $user->id)
                ->where('id', $data['conversation_id'])
                ->first();
            if (!$conversation) {
                return response()->json(['message' => 'Conversation not found'], 404);
            }
        } else {
            $conversation = AiConversation::create([
                'user_id' => $user->id,
                'title' => mb_substr($data['message'], 0, 80),
            ]);
        }

        AiMessage::create([
            'conversation_id' => $conversation->id,
            'role' => AiMessage::ROLE_USER,
            'content' => $data['message'],
        ]);

        try {
            $reply = $this->runAssistantReply($user, $conversation, $openAi, $contextBuilder);
        } catch (RuntimeException $e) {
            return response()->json([
                'message' => $e->getMessage() === 'OpenAI request failed'
                    ? 'AI service temporarily unavailable'
                    : $e->getMessage(),
            ], 502);
        }

        if ($reply === '') {
            return response()->json(['message' => 'Empty AI response'], 502);
        }

        AiMessage::create([
            'conversation_id' => $conversation->id,
            'role' => AiMessage::ROLE_ASSISTANT,
            'content' => $reply,
        ]);

        $conversation->touch();

        return response()->json([
            'conversationId' => (string) $conversation->id,
            'reply' => $reply,
        ]);
    }

    public function summarizeToday(Request $request, OpenAiChatService $openAi, AiContextBuilder $contextBuilder): JsonResponse
    {
        $user = $request->user();
        if (!$this->canUseAssistant($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'conversation_id' => 'nullable|string',
        ]);

        if (!$openAi->isConfigured()) {
            return response()->json([
                'message' => 'AI is not configured. Set OPENAI_API_KEY in .env',
            ], 503);
        }

        $conversation = null;
        if (!empty($data['conversation_id'])) {
            $conversation = AiConversation::query()
                ->where('user_id', $user->id)
                ->where('id', $data['conversation_id'])
                ->first();
            if (!$conversation) {
                return response()->json(['message' => 'Conversation not found'], 404);
            }
        } else {
            $conversation = AiConversation::create([
                'user_id' => $user->id,
                'title' => 'Today’s work summary',
            ]);
        }

        $snapshot = $contextBuilder->snapshotForSummarizeToday($user);
        $json = json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        if ($json === false) {
            $json = '{}';
        }

        $system = <<<'SYS'
You are an assistant for an aluminum factory ERP. Summarize "today's work" for the viewer using ONLY the JSON context. Include: task progress by status, overdue/due today if relevant, orders if relevant, team or org facts if relevant, and storehouse counts. Be concise with clear sections. If something is not in the JSON, do not invent it. Use the viewer's role to choose what to emphasize.
SYS;

        $userPrompt = "CONTEXT_JSON:\n{$json}\n\nWrite the summary in the same language the viewer likely uses (Arabic or English) based on names/context, or English if unclear.";

        try {
            $reply = $openAi->chatCompletion([
                ['role' => 'system', 'content' => $system],
                ['role' => 'user', 'content' => $userPrompt],
            ], 0.25, 4096);
        } catch (RuntimeException $e) {
            return response()->json([
                'message' => $e->getMessage() === 'OpenAI request failed'
                    ? 'AI service temporarily unavailable'
                    : $e->getMessage(),
            ], 502);
        }

        if ($reply === '') {
            return response()->json(['message' => 'Empty AI response'], 502);
        }

        $intro = $user->role === 'employee'
            ? 'Summary of your work (from system data):'
            : 'Summary of today’s operational snapshot:';

        AiMessage::create([
            'conversation_id' => $conversation->id,
            'role' => AiMessage::ROLE_USER,
            'content' => '[Summarize today’s work]',
        ]);

        AiMessage::create([
            'conversation_id' => $conversation->id,
            'role' => AiMessage::ROLE_ASSISTANT,
            'content' => $intro . "\n\n" . $reply,
        ]);

        $conversation->touch();

        return response()->json([
            'conversationId' => (string) $conversation->id,
            'reply' => $intro . "\n\n" . $reply,
        ]);
    }

    private function runAssistantReply($user, AiConversation $conversation, OpenAiChatService $openAi, AiContextBuilder $contextBuilder): string
    {
        $snapshot = $contextBuilder->snapshotForChat($user);
        $json = json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        if ($json === false) {
            $json = '{}';
        }

        $system = <<<SYS
You are a helpful assistant for an aluminum factory management system (tasks, orders, inventory/storehouse, users).

Rules:
1) For factual questions about counts, tasks, users, orders, or stock, use ONLY the CONTEXT_JSON below. If the answer is not there, say you do not see that data in the current snapshot.
2) You may give general best-practice advice that does not contradict the context.
3) Keep answers concise unless the user asks for detail.
4) Do not reveal secrets or internal tokens.

CONTEXT_JSON:
{$json}
SYS;

        if ($user->role === 'employee') {
            $system .= <<<'EMP'

Additional scope: The viewer is an employee. Emphasize their own assigned tasks, due dates, overdue counts, and orders they created. Do not imply they can see other employees’ private tasks or admin-only user lists unless that data explicitly appears in CONTEXT_JSON for their role.
EMP;
        }

        $history = $conversation->messages()
            ->orderByDesc('id')
            ->limit(self::HISTORY_MESSAGE_LIMIT)
            ->get()
            ->sortBy('id')
            ->values();

        $openAiMessages = [['role' => 'system', 'content' => $system]];
        foreach ($history as $m) {
            if (!in_array($m->role, [AiMessage::ROLE_USER, AiMessage::ROLE_ASSISTANT], true)) {
                continue;
            }
            $openAiMessages[] = [
                'role' => $m->role === AiMessage::ROLE_USER ? 'user' : 'assistant',
                'content' => $m->content,
            ];
        }

        return $openAi->chatCompletion($openAiMessages, 0.35, 4096);
    }

    private function canUseAssistant(?\App\Models\User $user): bool
    {
        return $user && in_array($user->role, ['admin', 'supervisor', 'employee'], true);
    }

    private function taskTextSystemPrompt(string $field, string $mode): string
    {
        $isTitle = $field === 'title';

        $context = $isTitle
            ? 'This is a short task title for an aluminum factory production / operations task.'
            : 'This is a task description for factory workers and supervisors in an aluminum business.';

        return match ($mode) {
            'improve' => "{$context} Rewrite the following text to be clearer, concise, and professional. Preserve the original language. Output only the rewritten text, no quotes or explanation.",
            'shorten' => "{$context} Shorten the following text while keeping essential meaning. Preserve the original language. Output only the shortened text, no quotes or explanation.",
            'translate_en' => "{$context} Translate the following text into clear English. Output only the English translation, no quotes or explanation.",
            'translate_ar' => "{$context} Translate the following text into clear Modern Standard Arabic suitable for workplace use. Output only the Arabic translation, no quotes or explanation.",
        };
    }
}
