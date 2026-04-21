# AI task assist (OpenAI)

## Summary

Supervisors can use **AI assist** buttons on the **Add/Edit task** modal to improve or shorten the **title** and **description**, or translate the **description** to English or Arabic. The OpenAI API key is **only stored on the Laravel server** (`OPENAI_API_KEY` in `.env`); the React app never sees it.

## API

- `POST /api/ai/task-text` (Sanctum auth; **supervisor** or **admin** only)
- Body: `{ "field": "title" | "description", "text": "...", "mode": "improve" | "shorten" | "translate_en" | "translate_ar" }`
- Response: `{ "text": "..." }`
- Rate limit: 20 requests per minute per user (throttle middleware).

## Modules

- Backend: [`config/openai.php`](../../backend/config/openai.php), [`App\Services\OpenAiChatService`](../../backend/app/Services/OpenAiChatService.php), [`AiController`](../../backend/app/Http/Controllers/AiController.php), route in [`api.php`](../../backend/routes/api.php).
- Frontend: [`aiApi`](../../frontend/src/services/api.ts), [`TaskModal.tsx`](../../frontend/src/components/supervisor/TaskModal.tsx).

## Configuration

Set in `.env` (see `.env.example`):

- `OPENAI_API_KEY` — required for AI to work
- `OPENAI_MODEL` — defaults to `gpt-4o-mini`

## Limitations

- No automatic save: the user must still click **Save** on the task.
- Long text is capped at 8000 characters per request.
