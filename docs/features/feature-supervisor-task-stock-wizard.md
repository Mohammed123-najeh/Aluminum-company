# Supervisor: two-step task creation & full-screen stock / receipt

## Summary

Supervisors create tasks in **two stages**: (1) a **compact modal** for task fields and assignees, then (2) a **near full-screen** flow to **select inventory lines**, see **pricing and totals**, and **issue a receipt**. Product picking supports **row selection**, **custom meter quantity**, and **+1 m … +4 m** shortcuts. The printed-style receipt includes **customer name**, **phone**, **registered client** (if any), **line detail** (profile, color, quantity, unit price, line total), and **grand total**. Editing an existing task uses the same **full-screen stock** experience via **Products & receipt**.

## Purpose

Separates task metadata from the sales-desk UI so the stock step is not squeezed into half a modal; improves accuracy when choosing a specific inventory row and matches supervisor expectations for a full receipt.

## User flows

1. **New task** → **Save & continue to products** → task is persisted → **Step 2** opens with filters, catalog, cart, **Issue receipt & complete task**.
2. **Finish without receipt** or **Back to task** (task already saved) exits or returns to step 1.
3. **Edit task** → **Products & receipt** opens the full-screen stock panel for that `task_id`.
4. After fulfillment, **receipt** shows enriched customer fields from the task form; **Close** dismisses the wizard (and parent modal where applicable).
5. **Confirm sale** dialog appears after **Issue receipt** / **Complete from stock**: review lines (and totals for supervisors), then **Confirm** to call the API.

## Inventory quantities (dev / demo)

`StorehouseSeeder` seeds each profile×color row with **10–30 m** (not zero). For databases that were seeded earlier with `0`, run:

`php artisan db:seed --class=InventoryStockSeeder`

## Frontend robustness

- Catalog rows normalize **`quantity_m` / prices** to numbers (Laravel may JSON-encode decimals as strings) so **+1 m … +4 m** enable/disable logic is correct.
- **Selected product** panel is **above** the scrollable list so it stays visible; row **select** uses a real `<button>` for reliable clicks.

## Modules

- `frontend/src/components/supervisor/TaskModal.tsx` — wizard state, step 2 shell, edit stock overlay.
- `frontend/src/components/shared/StockTaskFulfillmentPanel.tsx` — `variant: embedded | fullscreen`, `receiptCustomerInfo`, selection UX, `onReceiptDismiss`.
- Backend unchanged: `POST /api/sales/fulfill-task` (supervisor must own task).

## Limitations

- Customer name/phone on the receipt are **UI-only** (from task form state); persisted order still uses task `customer_*` / `client_id` as before.
- Fulfilling a **completed** task is rejected by the API (button may still appear on completed tasks).
