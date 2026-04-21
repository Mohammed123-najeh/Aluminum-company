# Supervisor team analytics

## Summary

Supervisors get a **Team analytics** section with KPI cards, per-employee workload visualization (stacked status bar + expandable task list), and a filterable task table. **Completion time** is derived from `createdAt` to `completedAt` when a task is marked completed; `completed_at` is set automatically on that transition (with historical backfill from `updated_at`).

## Backend

- Migration `completed_at` nullable on `tasks`.
- `TaskController` sets `completed_at` when status moves to `completed`, clears when leaving `completed`.
- API field: `completedAt` (ISO string) on task JSON.

## Frontend

- `SupervisorAnalytics.tsx`: dashboard UI; uses `employees` + `tasks` from existing hooks.
- `SupervisorPage`: new nav item and section.

## UX notes

- Overdue = `dueDate` before today and status not `completed` or `cancelled`.
- Per-assignee counts count each task once per assignee (shared tasks affect each member’s workload).
