# HR dashboard, leave & salary requests

## Summary

HR staff use the same **employee** account type (`employeeType: hr`) as other employees but get extra sidebar items: **HR center** (pending reviews, roster compensation) and **HR analytics** (workforce metrics). All employees—including HR—can use **My requests** to submit **annual leave**, **sick leave**, and **salary review** requests. Admins can set **base salary** and **annual leave balance** when creating/editing users; HR can update those two fields for any non-admin user via the HR center roster.

## Purpose

- Centralize **time-off and compensation workflows** without mixing them with customer **receipt/payment** financials.
- Give HR a **read-only analytics** snapshot (pending counts, approved days by type, recent activity).

## User flows

1. **Admin** creates an account with role **Employee** and type **HR** (optionally sets salary and leave days).
2. **Employee** opens **My requests**, submits leave or salary request; **pending** items appear in **HR center** for HR (and notifications go to active HR accounts).
3. **HR** approves or rejects requests; approved **holiday** leave **deducts** requested days from the employee’s `annual_leave_balance`. Approved **salary** requests can apply an optional **approved monthly amount** (defaults to requested).
4. **HR analytics** shows KPIs, a **directory table** of every non-admin account (salary, leave balance, YTD sick/holiday days, pending counts), and **clicking a row** opens a modal with **full leave and salary request history** plus profile and YTD / all-time approved day totals.

## API (Sanctum, `auth:sanctum`)

| Method | Path | Who | Description |
|--------|------|-----|-------------|
| GET | `/api/leave-requests/mine` | Employee | Own leave rows |
| GET | `/api/leave-requests` | HR or Admin | All leave (filters `?status=&type=`) |
| POST | `/api/leave-requests` | Employee | Create leave (`holiday` \| `sick`) |
| PATCH | `/api/leave-requests/{id}/decide` | HR or Admin | Approve/reject pending |
| PATCH | `/api/leave-requests/{id}/cancel` | Owner | Cancel pending |
| GET | `/api/salary-requests/mine` | Employee | Own salary rows |
| GET | `/api/salary-requests` | HR or Admin | All salary rows |
| POST | `/api/salary-requests` | Employee | Request new monthly salary |
| PATCH | `/api/salary-requests/{id}/decide` | HR or Admin | Approve/reject (+ optional approved amount) |
| PATCH | `/api/salary-requests/{id}/cancel` | Owner | Cancel pending |
| GET | `/api/hr/analytics` | HR or Admin | Dashboard JSON (includes `directory[]` roster rows) |
| GET | `/api/hr/users/{id}/hr-detail` | HR or Admin | Profile + all leave + salary requests + YTD/all-time approved day totals |

**User compensation**

- `users.base_salary`, `users.annual_leave_balance` are exposed on `GET /api/me` and `GET /api/users`.
- **Admin**: full `PUT /api/users/{id}` including compensation.
- **HR**: `PUT /api/users/{id}` with **only** `base_salary` and/or `annual_leave_balance` (no other fields).

## Data model

- `leave_requests`: type `holiday` \| `sick`, date range, `days_count`, status, decision metadata.
- `salary_increase_requests`: requested amount, optional snapshot of current salary, approval metadata and optional `approved_monthly_salary`.

## Frontend

- [`EmployeePage.tsx`](../../frontend/src/pages/EmployeePage.tsx) — sections `requests`, `hrCenter`, `hrAnalytics`; HR badge in sidebar when `employeeType === 'hr'`.
- [`EmployeeRequestsPanel.tsx`](../../frontend/src/components/employee/EmployeeRequestsPanel.tsx) — employee submission + history.
- [`HrCenterPanel.tsx`](../../frontend/src/components/hr/HrCenterPanel.tsx) — queues + roster table.
- [`HrAnalyticsPanel.tsx`](../../frontend/src/components/hr/HrAnalyticsPanel.tsx) — KPI cards and tables.
- [`UserModal.tsx`](../../frontend/src/components/admin/UserModal.tsx) — admin optional salary/leave on employee accounts.

## Design choices

- **HR remains `role: employee`** — reuses tasks, messages, AI assistant, and notifications without a new top-level role.
- **Notifications**: new types `hr_leave_pending`, `hr_salary_pending`, and decided variants for the employee (`InAppNotifier`).
- **Holiday balance check** on submit only when `annual_leave_balance` is set; if `null`, HR approves without auto balance validation.

## Limitations / extensions

- No PDF payslips, tax, or mid-year **accrual** rules—only numeric balance and approvals.
- `GET /api/users` remains broadly available to authenticated users; consider **role-scoped listing** in a hardening pass.
- Admin is not notified automatically when **no** active HR user exists; only HR recipients receive pending-request alerts.
