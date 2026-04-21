# Feature: Registered clients, task customer data, and sales receipts UX

## Summary

Supervisors can maintain a **Clients** registry (name, phone, email, notes), link tasks to a registered client, and optionally store a free-text **customer phone** on the task. Completed orders inherit `client_id` from the task when receipts are issued or draft orders are finalized. The employee **Receipts** view supports **search** (receipt number, creator name, task/customer/client fields), **pagination**, and **print** (opens a print-friendly window).

## Purpose

- Long-term customers with repeat orders need a single place to register and later review **purchase history**, **payments**, and **balance due**.
- Tasks should capture **customer phone** alongside name, either via a registered client or ad-hoc text.
- Large receipt lists need **pagination** and **search** so the UI stays usable.

## User flows

### Supervisor — Clients

1. Open **Clients** in the supervisor sidebar.
2. Register a client (name required; phone, email, notes optional).
3. Search the list by name, phone, or email.
4. Click a client to load **analytics**: order count, total purchases, total paid, balance due, and a table of completed orders.
5. Optional: print a simple summary from the detail panel.

### Supervisor — Tasks

1. When creating or editing a task, optionally select a **registered client** and/or enter **customer phone** (and existing customer name).
2. Saved tasks expose `clientId` / `clientName` / `clientPhone` (from client) and `customerPhone` (free text) to the API and UI.

### Employee — Receipts

1. Filter receipts with the search box (receipt number, employee/creator name, task customer name, registered client name/phone, order id substring).
2. Browse pages of **8** receipts per page.
3. Expand a row for line detail; use **Print** to open a print dialog with line items, total, paid, and balance.

## Backend modules

- **Migrations:** `clients` table; `tasks.client_id`, `tasks.customer_phone`; `orders.client_id`, `orders.amount_paid`.
- **Models:** `Client`, `Task` / `Order` relations.
- **API:** `ClientController` (`GET/POST /clients`, `GET/PATCH/DELETE /clients/{client}`), `OrderController@updatePayment` (`PATCH /orders/{order}/payment`), `TaskController` accepts `client_id`, `customer_phone`, `customer_name` on create/update.
- **Services:** `FinalizeDraftOrderForCompletedTask` and `SalesTaskFulfillmentController` set `order.client_id` (and `amount_paid` default) from the task when completing.

## Design decisions

- **Supervisor-scoped clients:** `clients.supervisor_id` ensures each supervisor only sees their own registry (admins can extend access later if needed).
- **Balance due:** `max(0, sum(total_amount) - sum(amount_paid))` on completed orders; `amount_paid` is updated via `PATCH /orders/{order}/payment` for completed orders.
- **Receipt list:** Search and pagination are implemented **in the browser** on the full `GET /orders` payload to avoid changing the list contract; very large datasets may need server-side pagination later.

## Limitations and follow-ups

- Employees cannot list clients via API (supervisor-only); client info on receipts comes from **orders** returned with `client` embedded.
- Recording payment on completed orders is available via API; a dedicated supervisor UI for payment entry can be added later.
- Feature doc should be updated if list endpoints gain server-side `q` / `page` parameters.
