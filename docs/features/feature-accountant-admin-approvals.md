# Feature: Accountant finance dashboard, PDF reports, admin approval center, admin-only salary decisions

## Summary

Delivers roadmap items: **accountant**-scoped cash-flow KPIs and PDF export for completed receipts, **publish-to-admin** for finance reports, a unified **admin approval** UI for pending salary requests and generic **submissions**, and **admin-only** API decisions for salary increases (HR sees pending requests but cannot finalize).

## Purpose

- Centralize sensitive **salary approvals** with administrators while keeping HR informed.
- Give accountants a **finance-first** workspace without stock/inventory noise (mirrors HR hiding inventory).
- Provide a single **admin inbox** for salary + submitted documents (finance PDFs and future types).

## User flows

1. **Employee (accountant)** — Sidebar **Finance**: pick period (day/week/month/year), view totals and receivables-style tables, **Download PDF**, **Publish to admin** (generates PDF server-side and creates a pending submission).
2. **Administrator** — Sidebar **Approvals**: tabs for **Salary** (approve/reject with optional approved amount) and **Submissions** (approve/reject; download attached PDF when present). Sidebar badge shows pending salary + pending submissions.
3. **HR** — **HR Center** still lists pending salary rows **read-only** with copy that **admin** approves; leave approval unchanged.

## Backend

| Piece | Location |
|-------|-----------|
| Migrations | `database/migrations/*_create_admin_submissions_table.php` |
| Model | `app/Models/AdminSubmission.php` |
| Accountant endpoints | `GET /api/accountant/cash-flow`, `GET /api/accountant/receipt-report.pdf`, `POST /api/accountant/publish-report` — `AccountantFinanceController` |
| Admin queue | `GET /api/admin/approvals/summary`, `GET /api/admin/submissions`, `PATCH /api/admin/submissions/{id}/decide`, `POST /api/submissions`, `GET /api/my-submissions`, `GET /api/submissions/{id}/attachment` |
| Salary policy | `SalaryIncreaseRequestController::decide` — **admin only** |
| Notifications | `InAppNotifier`: salary pending → admins + HR (informational); submission pending → admins |

## Frontend

- `components/accountant/AccountantFinancePanel.tsx`
- `components/admin/AdminApprovalCenter.tsx`
- `EmployeePage.tsx` — `accountantFinance` section for `employeeType === 'accountant'`
- `AdminPage.tsx` — `approvals` view
- `services/api.ts` — `accountantFinanceApi`, `adminApprovalsApi`, `submissionsApi`, download helpers

## Dependencies

- `barryvdh/laravel-dompdf` for PDF generation.

## Limitations / next steps

- Cash-flow scope is **receipt/order payment aggregate** (money in + outstanding); no supplier/payroll **outflows** until modeled.
- Supervisor/HR “generic submission” UI can use `POST /api/submissions` with multipart `attachment` — optional dedicated forms later.
