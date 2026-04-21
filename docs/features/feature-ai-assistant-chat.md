# AI assistant chat (persisted conversations)

## Summary

**Employee**, **supervisor**, and **admin** each have an **AI assistant** section. Users can ask questions about data they are allowed to see; the backend injects a **fresh JSON snapshot** (tasks, orders, users, storehouse counts) into the model prompt. Chats are **saved** per user (`ai_conversations`, `ai_messages`). **Summarize today’s work** generates a structured summary from that snapshot (task progress, overdue/due today where relevant, team/org for supervisors/admins).

**Employee dashboard** uses the same panel with **employee-scoped** snapshot fields (`dataFocus`, assigned tasks, supervisor info when assigned, own orders) and **employee-only slash prompts** (supervisor context, order detail, next priority, update text for supervisor). The system prompt also nudges the model to stay within employee-visible data.

**Share conversations:** the owner can **Copy share link** on the active chat. The link is `?aiShare=<uuid>` on the app origin (same path for all roles). Any **logged-in** user can open it; the UI loads the thread **read-only** and can **Save a copy to my chats** (duplicates messages into a new conversation owned by the viewer). Closing the shared view or switching to your own chats clears the query param.

## API (Sanctum)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ai/conversations` | List conversations (max 50) |
| GET | `/api/ai/conversations/{id}/messages` | Load messages |
| POST | `/api/ai/conversations/{id}/share` | Ensure `share_token` exists; returns `{ shareToken }` |
| GET | `/api/ai/shared/{token}` | Read shared conversation (messages + owner name); any authenticated role |
| POST | `/api/ai/conversations/import-shared` | Body: `share_token` — copy messages into a new conversation for current user |
| DELETE | `/api/ai/conversations/{id}` | Delete conversation |
| POST | `/api/ai/chat` | Body: `message`, optional `conversation_id` — appends user + assistant messages |
| POST | `/api/summarize-today` | Body: optional `conversation_id` — appends summary into chat |

Throttles: chat 30/min, summarize 15/min, share 30/min, import-shared 20/min.

## Scope rules (backend)

- **Employee:** own assigned tasks, own orders created, storehouse stats, due/overdue counts, assigned supervisor (`supervisor` + `dataFocus` in snapshot).
- **Supervisor:** team list, tasks owned, per-employee task counts, orders in scope, storehouse.
- **Admin:** user sample (up to 150), role counts, all tasks by status, order total, storehouse.

The model is instructed **not to invent** facts outside `CONTEXT_JSON`.

## Frontend

- [`AiAssistantPanel.tsx`](../../frontend/src/components/ai/AiAssistantPanel.tsx) — props: `viewerRole`, `initialShareToken`, `onShareConsumed`.
- Slash commands: type **`/`** in the message box to open **quick prompts** (role-filtered; employees get extra prompts). See [`slashPrompts.ts`](../../frontend/src/components/ai/slashPrompts.ts).
- Deep link: [`main.tsx`](../../frontend/src/main.tsx) reads `aiShare` and passes it into each dashboard; opening the assistant tab when a token is present.

## Requirements

- `OPENAI_API_KEY` in `.env` (see [`feature-ai-task-assist.md`](feature-ai-task-assist.md)).

## Limitations

- Snapshot size: long task lists are truncated (samples + counts).
- Not a replacement for reports; numbers are as of request time.
- Share links require **authentication**; anyone with the link can open the thread after login (capability URL). Revocation is not implemented (clearing `share_token` would be a future admin/owner action).
