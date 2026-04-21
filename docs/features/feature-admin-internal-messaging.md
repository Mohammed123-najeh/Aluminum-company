# Admin internal messaging

## Summary

Administrators can use the same **internal** messaging system as supervisors and employees: thread list, conversation view, and send messages to **supervisors and employees** only (not other admins).

## Purpose

Admins need to coordinate with staff without impersonating a supervisor. This extends `MessageController` and reuses the existing `useMessages` hook and API shape (`receiverId`-style thread summaries) for consistency with the supervisor UI.

## User flows

1. Admin opens **Messages** in the admin sidebar or header tabs.
2. Left column lists all non-admin users (supervisors and employees) from user management data; previews come from `GET /messages` when the backend returns thread summaries.
3. Selecting a user loads `GET /messages?receiver_id=…` and shows the thread.
4. Admin sends a message via `POST /messages` (body only in the UI; optional `task_id` is supported by the API if the task is assigned to the recipient).
5. Tapping a **message** notification opens the Messages view with the peer pre-selected (`onOpenMessagesWithPeer` on `NotificationBell` / `NotificationsPanel`).

## Modules and APIs

- **Backend:** `backend/app/Http/Controllers/MessageController.php`
  - `index` without `receiver_id`: admin gets deduplicated peers from messages where the admin is sender or receiver; each summary uses `receiverId` as the **peer** id (same convention as supervisor summaries).
  - `index` with `receiver_id`: allowed only if the other user exists and is not an admin.
  - `store`: admin may message non-admin, non-suspended users; `task_id` requires the task to be assigned to the **receiver**.
- **Frontend:** `frontend/src/components/admin/AdminMessages.tsx`, `frontend/src/pages/AdminPage.tsx`, `frontend/src/hooks/useMessages.ts`, `frontend/src/services/api` (messages endpoints).

## Design decisions

- **No admin-to-admin DMs** — reduces noise and avoids unclear escalation paths; policy can be revisited later.
- **Staff list from `useUsers()`** — admins see everyone who can be messaged even before the first message (supervisor list is team-scoped; admin list is org-wide non-admins).
- **No task picker in admin UI** — sending is plain text; backend still accepts `task_id` for API completeness and future UI.

## Gotchas and limitations

- Suspended users cannot receive messages from admin (403 on send).
- `TaskController@index` is unchanged; admins still do not get a task list for linking tasks in the UI without further API work.
- Thread summaries for admin include **both** directions (latest message per peer), unlike the supervisor list which is historically outbox-only for summaries.

## Future extensions

- Task picker for admins backed by a dedicated admin-safe task query (e.g. filter by assignee).
- Mute or archive threads; read receipts if added globally.
