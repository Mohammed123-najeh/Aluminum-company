# Admin analysis dashboard

## Summary

A dedicated **Analysis** area in the admin panel shows organization-wide metrics: user and team structure, task and order pipelines, internal messaging activity, storehouse inventory totals, and AI assistant usage. **Profit, revenue, and receipt / AR analysis** live in a **separate sidebar section** (“Profit & receipts”) and `AdminFinancialAnalytics`, not inside Analysis, so finance stays easy to find.

## Purpose

Give administrators a single read-only view of operational health without opening each functional area. Data is aggregated on the server (`GET /admin/analytics`) so counts stay consistent and the UI stays simple.

## User flows

1. Admin opens **Analysis** from the sidebar or header tabs.
2. The page loads analytics (and can **Refresh** to reload).
3. Sections present: overview cards, task/order distributions, employee specialty split, storehouse + AI stats, supervisor team table, tasks-by-supervisor table.

For receipts, collection, and outstanding balances, use **Profit & receipts** in the sidebar (same API’s `financial` block, see `feature-receipt-payments-analytics.md`).

## APIs and modules

- **Backend:** `App\Http\Controllers\AdminAnalyticsController`, route `GET /api/admin/analytics` (Sanctum, **admin only**).
- **Frontend:** `useAdminAnalytics`, `AdminAnalytics`, wired from `AdminPage` view `analytics`.
- **Types:** `ApiAdminAnalytics` in `frontend/src/services/api.ts`.

## Design decisions

- **Admin-only endpoint** — Supervisors and employees receive 403; avoids exposing global counts to non-admins.
- **Single payload** — One JSON document keeps the page snappy and avoids N+1 client calls.
- **Overdue tasks** — Same end-of-day rule as supervisor analytics (due after end of due date, not completed/cancelled).

## Gotchas and limitations

- Large datasets load fully in memory on the server; acceptable for typical factory scale. For very large history, add pagination or materialized rollups later.
- Order status breakdown only includes known statuses: `draft`, `submitted`, `in_progress`, `completed`, `cancelled`.
- Employee type “unset” counts rows with `employee_type` null; empty strings are not folded into unset unless the app stores them that way.

## Future extensions

- Date-range filters and trend charts.
- Export CSV/PDF.
- Deeper order and revenue metrics if business rules require them.
