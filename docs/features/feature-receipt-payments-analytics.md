# Receipts, partial payments, and payment analytics

## Summary

End-to-end support for **recording partial or full payment at issue time**, **due dates and notes** on completed orders, **receipt list filtering** (status, overdue, customer grouping), **supervisor payment analytics** (scoped KPIs), **admin financial rollup** on the analysis dashboard, and a **third-step payment dialog** before the final receipt view when supervisors fulfill from stock.

## Purpose

Sales often collect a deposit or half payment; the remainder may be scheduled. Supervisors and admins need visibility into who paid, who owes, what is overdue, and aggregates by time window—without a full accounting ERP.

## User flows

1. **Supervisor: task → products → confirm lines → payment popup → receipt**  
   After confirming cart lines, the supervisor enters amount paid now (defaults to full total), optional balance due-by date, and optional notes. The API stores `amount_paid`, `payment_due_at`, and `payment_notes` on the order. The receipt screen shows total, paid, balance, due date, and derived status (paid / partial / unpaid).

2. **Supervisor: receipts page**  
   Search, filter by payment status, filter by due/balance (has balance, overdue, due within 7 days), optional grouping by customer label (registered client name, task customer name, or reference). Expand a row to **edit payment** (amount, due date, notes) via `PATCH /orders/{id}/payment`.

3. **Supervisor: Team analytics → Payments & receipts tab**  
   Loads scoped analytics from `GET /receipt-payment-analytics` (same scope rules as orders: supervisor_id or creator_id).

4. **Admin: Profit & receipts** (sidebar, under “Revenue & receipts”)  
   Dedicated full-page dashboard (`AdminFinancialAnalytics`) uses the same `GET /admin/analytics` payload’s `financial` object plus a **recent receipts** table from `GET /orders?receipts_only=1`. The general **Analysis** view no longer duplicates the long financial section.

## APIs and data

| Piece | Location |
|--------|-----------|
| Payment fields on orders | `orders.amount_paid`, `orders.payment_due_at`, `orders.payment_notes` (migration `2026_04_05_000001_add_payment_due_to_orders`) |
| Payment status derivation | `Order::derivePaymentStatus()` |
| Fulfill with initial payment | `POST /sales/fulfill-task` — `initial_amount_paid`, `payment_due_at`, `payment_notes` |
| Update payment on completed order | `PATCH /orders/{order}/payment` |
| Order list filters | `GET /orders?receipts_only=1&payment_status=paid\|partial\|unpaid\|unknown` |
| Supervisor/admin KPIs | `GET /receipt-payment-analytics` |
| Admin bundle | `GET /admin/analytics` → `financial` |

Shared aggregation logic lives in `App\Support\ReceiptPaymentAnalytics` to keep controllers aligned.

## Design decisions

- **Single due date per receipt**, not a full installment schedule table—notes field carries human-readable schedules until a dedicated `order_payment_installments` model is justified.
- **Customer grouping** for analytics and UI uses a **display label** (client name → task customer name → customer reference → "—"), not a stable CRM merge key.
- **“Today” buckets** use order `updated_at` (receipt activity), not payment event log—there is no separate payments ledger row.

## Limitations and extensions

- No immutable payment history audit trail (only latest `amount_paid` / due / notes).
- Employees fulfilling tasks do not see prices; payment step is supervisor-only in the UI; backend still defaults their fulfillments to `amount_paid = 0`.
- Adding **installment rows**, **PDF receipt templates**, or **automated reminders** would be natural follow-ups.
