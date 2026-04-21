# Supervisor home dashboard, orders list, low-stock awareness

## Summary

- **Home (dashboard)** — Default supervisor landing view with widgets: overdue tasks, tasks due today, low-stock line count (using `LOW_STOCK_THRESHOLD_M` from `frontend/src/constants/inventory.ts`), active orders count, message thread count (supervisor outbound summaries), plus short lists for overdue/due-today tasks and recent orders.
- **Orders** — Read-only list of orders in the supervisor’s API scope (`GET /api/orders` — same rules as backend: supervisor sees orders they supervise or created). Row click opens a detail modal.
- **Low stock** — Inventory table highlights rows where `quantityM <= LOW_STOCK_THRESHOLD_M` and shows an amber banner when any line is low.

## Purpose

Give supervisors one place to see risk (dates, stock, orders) without opening every section; surface team orders without using the employee Orders UI.

## User flows

1. Log in as supervisor → lands on **Home**.
2. Use **View all** on a widget → navigates to Tasks, Messages, Orders, or Inventory.
3. Open **Orders** → browse cards → open modal for full line items and linked task title.
4. Open **Inventory** → if any line ≤ threshold, see banner and highlighted rows.

## Modules

- `SupervisorPage.tsx` — `useOrders()` at page level (single fetch shared by Home + Orders); sections `home`, `orders`.
- `SupervisorDashboard.tsx` — `useStorehouse()` for low-stock count; `messagesApi.list(token)` for thread count.
- `SupervisorOrders.tsx` — Presentational; receives `orders`, `loading`, `error`.
- `EmployeeInventory.tsx` — Low-stock banner + row tint.
- `constants/inventory.ts` — `LOW_STOCK_THRESHOLD_M` (default `10`).

## Design notes

- **Threshold** is global and client-side; changing it updates both dashboard and inventory UI.
- **Message count** reflects the existing supervisor message index (latest outbound message per employee thread), not full unread semantics.
- **Active orders** widget excludes statuses `completed` and `cancelled`.

## Limitations / extensions

- Per-SKU or per-category thresholds would need API or settings storage.
- True “unread” messages for supervisors would need backend support.
