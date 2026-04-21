# Dashboard in-app notifications

## Summary

All roles (**admin**, **supervisor**, **employee**) get a **Notifications** area: sidebar item (with **unread count badge**), **header bell** (same badge + dropdown), and a full **Notifications** view. Notifications are stored in MySQL (`user_notifications`), scoped per user, with `read_at` for unread state.

## What triggers a notification

| Type | Recipient | When |
|------|-----------|------|
| `message` | Receiver | A supervisor or employee sends an internal message |
| `task_assigned` | Each assignee | Supervisor creates a task with assignees |
| `task_status` | Owning supervisor | An assignee changes task status |
| `welcome` | New user | Admin creates a user account (via API) |

## API (Sanctum)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | Recent notifications (max 50); `?unread_only=1` optional |
| GET | `/api/notifications/unread-count` | `{ count }` for badges |
| PATCH | `/api/notifications/{id}/read` | Mark one read |
| POST | `/api/notifications/read-all` | Mark all read for current user |

## Frontend

- [`useNotifications.ts`](../../frontend/src/hooks/useNotifications.ts) — loads list, **polls unread count every 45s**
- [`NotificationBell.tsx`](../../frontend/src/components/notifications/NotificationBell.tsx) — bell + dropdown; opens thread or tasks when applicable
- [`NotificationsPanel.tsx`](../../frontend/src/components/notifications/NotificationsPanel.tsx) — full-page list
- Wired on [`AdminPage`](../../frontend/src/pages/AdminPage.tsx), [`SupervisorPage`](../../frontend/src/pages/SupervisorPage.tsx), [`EmployeePage`](../../frontend/src/pages/EmployeePage.tsx)

## Design choices

- **Polling** instead of WebSockets — simple, no extra infra; count refreshes on an interval and when opening the dropdown.
- **Dedicated table** instead of Laravel’s `notifications` channel — small, explicit schema and JSON `data` for deep-link ids (`peerId`, `taskId`).
- **Badge** on sidebar + bell: unread count capped display (`99+` in the bell).

## Limitations / extensions

- Admin users typically only see `welcome`-style rows if they were created as a normal user; consider future **admin alerts** (e.g. new signups) as separate types.
- No push/email; in-app only.
- Large history: list is capped at 50; add pagination if needed.
