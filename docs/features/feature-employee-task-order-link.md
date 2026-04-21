# Employee: tasks ↔ orders linking and product search

## Summary

Employees create orders **only from My Tasks** (no separate Orders page). **Create order from task** opens `CreateOrderModal` in place; the new order can link to that task on submit. Product picking uses category + search (capped list) as before.

## Purpose

- Connect production work (tasks) to formal orders without losing context.
- Reduce friction when many profile × color combinations exist (search + category filter + capped result list).

## User flows

1. **Overview** — Default landing: analytics for the employee’s tasks, stock, and orders they created.
2. **My Tasks** — Search/filter tasks. Change status with the buttons on each card. For active tasks **without** an order, **Create order from task** opens the modal with the task pre-linked.
3. **Create order** — Customer reference, linked-task banner. Category must be chosen first; then search is scoped to that category. On success, tasks refresh so the task shows the linked order; status may move to `in_progress` per backend.

## Modules and APIs

- **Backend**: `OrderController@store` optional `task_id`; validates assignee/supervisor; sets `tasks.order_id`. `orderToArray` includes `taskId` / `taskTitle`.
- **Frontend**: `EmployeeTasks` embeds `CreateOrderModal`, `useOrders`, `useStorehouse`; `onRefetchTasks` after create.

## Design decisions

- **No employee Orders section** — avoids duplicate entry points; orders are task-driven.
- **Standalone order without a task** is not offered in the employee UI (supervisors still have full order flows as needed).

## Gotchas and extensions

- Tasks already linked to an order cannot be linked again (400 from API).
- If storehouse data is still loading, **Create order from task** stays disabled until profiles/colors load.
