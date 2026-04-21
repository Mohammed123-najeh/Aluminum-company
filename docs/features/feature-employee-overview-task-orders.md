# Employee overview dashboard & task-only order creation

## Summary

- **Removed** the dedicated **Orders** sidebar section for employees.
- **Orders** are created only from **My Tasks**: each open task has **Create order from task**, which opens `CreateOrderModal` in place; after submit, tasks refetch so status and linked order update.
- **Overview** is the default employee landing page: analytics cards (overdue, due today, low stock, active orders you created), task status mix bars, work summary, and recent orders list.
- **Task detail panel** (`EmployeeTaskDetailPanel`): slide-over from **My Tasks** with full description, due date, assignees, linked order summary, status changes, attachments (upload/delete), and create order when allowed.
- **Overview reminders**: prominent banners for **overdue** and **due today** tasks with links that switch to **My Tasks** and open the detail panel for the chosen task (`focusTaskId` on `EmployeePage`).
- **Task attachments**: backend `task_attachments` table and API; files stored on the `public` disk under `task-attachments/` (run `php artisan storage:link` for URLs).

## User flows

1. **Login** → **Overview** (analytics).
2. **My Tasks** → pick a task → **Create order from task** → add products → submit → task links to order (backend) → use status buttons on the task card to advance work.
3. **Inventory** unchanged for stock lines.

## Frontend

- `EmployeePage.tsx` — sections: `overview` | `tasks` | `messages` | `inventory` | `settings`; default `overview`; passes `focusTaskId` / `onFocusTaskConsumed` and attachment helpers from `useTasks` into `EmployeeTasks`; `onOpenTask` from Overview navigates to tasks and sets `focusTaskId`.
- `EmployeeAnalytics.tsx` — `useTasks` data from parent, `useOrders`, `useStorehouse`, `messagesApi.list` for inbox thread count; overdue / due-today reminder banners (`taskDueBucket` from `utils/taskDates`).
- `EmployeeTasks.tsx` — `useOrders`, `useStorehouse`, embedded `CreateOrderModal`, `EmployeeTaskDetailPanel`, attachment upload/delete.
- **Deleted** `EmployeeOrders.tsx`.

## i18n / marketing

- Login page third tile: Overview blurb instead of generic orders.
- `noOrdersForTask` and related strings point users to My Tasks.

## Gotchas

- Multiple `useStorehouse` / `useOrders` instances can still mount with hidden `SectionPanel` children (same as supervisor).
