# Inventory CRUD, supervisor task delete, task-linked messages

## Summary

- **Inventory**: Authenticated users with access to the storehouse (employee and supervisor UIs) can add profile+color stock lines, edit profile/color/quantity, edit the **profile display name** (updates the shared `profiles` row), and delete lines via `POST`/`PATCH`/`DELETE` under `/api/storehouse/inventory` plus `PATCH /api/storehouse/profiles/{profile}` for `name`.
- **Supervisor tasks**: The owning supervisor can delete a task (`DELETE /api/tasks/{id}`); UI shows Delete on each task card with confirmation.
- **Messages**: Optional `task_id` on messages links a thread message to a task; API validates assignee/supervisor rules. Supervisor messages view lists all team employees, shows that employee’s tasks when selected, and allows composing a reply with an optional task context. Employees see the task label on messages and can reply with an optional task link.

## APIs

| Method | Path | Notes |
|--------|------|--------|
| POST | `/storehouse/inventory` | `profile_id`, `color_code`, `quantity_m` — 409 if pair exists |
| PATCH | `/storehouse/inventory/{inventory}` | `profile_id`, `color_code`, `quantity_m` — 409 if another row has same pair |
| PATCH | `/storehouse/profiles/{profile}` | `name` — updates catalog profile name (all modules using that profile) |
| DELETE | `/storehouse/inventory/{inventory}` | 204 |
| DELETE | `/tasks/{task}` | Supervisor owner only, 204 |
| POST | `/messages` | Optional `task_id` |

## Frontend

- `EmployeeInventory`: CRUD when role is employee or supervisor (`canManageInventory` override optional).
- `SupervisorMessages`: Full employee list, task strip for selected employee, task selector on send.
- `EmployeeMessages`: Task badge on bubbles, optional task selector when replying to supervisor.
- `useStorehouse`: `createInventoryItem`, `updateInventoryItem`, `updateProfileName`, `deleteInventoryItem`.
- `useTasks`: `deleteTask`; `useMessages`: `sendMessage(body, taskId?)`.

## Gotchas

- Duplicate profile+color inventory rows must be updated, not created again (409).
- Task-linked messages clear the task reference if the task is deleted (`nullOnDelete`).
