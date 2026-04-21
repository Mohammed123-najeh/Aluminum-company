<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class OpenAiChatService
{
    public function isConfigured(): bool
    {
        return (bool) config('openai.api_key');
    }

    public function chat(string $system, string $userMessage): string
    {
        return $this->chatCompletion([
            ['role' => 'system', 'content' => $system],
            ['role' => 'user', 'content' => $userMessage],
        ]);
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     */
    public function chatCompletion(array $messages, ?float $temperature = 0.35, int $maxTokens = 4096): string
    {
        $key = config('openai.api_key');
        if (!$key) {
            throw new RuntimeException('OpenAI API key is not configured');
        }

        $model = config('openai.model', 'gpt-4o-mini');

        $response = Http::withToken($key)
            ->timeout(120)
            ->acceptJson()
            ->post('https://api.openai.com/v1/chat/completions', [
                'model' => $model,
                'messages' => $messages,
                'temperature' => $temperature,
                'max_tokens' => $maxTokens,
            ]);

        if (!$response->successful()) {
            Log::warning('OpenAI API error', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new RuntimeException('OpenAI request failed');
        }

        $data = $response->json();
        $content = $data['choices'][0]['message']['content'] ?? '';

        return is_string($content) ? trim($content) : '';
    }
}
