# Roadmap: Accountant finance dashboard, cash-flow PDF reports, and unified admin approval center

This document captures **requirements only** (no implementation yet). It ties together: accountant-facing finance tooling, admin receipt of reports, **admin-only approval for salary changes**, HR autonomy on non-monetary leave, and a **single admin inbox** for all cross-role approvals and submissions.

## 1. Accountant dashboard (new employee experience)

**Purpose:** Give `employeeType: accountant` (and/or a dedicated route) a **finance-first** workspace—not the default tasks/inventory shell unless desired.

**Capabilities (target):**

| Area | Description |
|------|-------------|
| **Cash flow view** | System-wide picture of **money in** vs **money out** derived from existing domains: e.g. payments on completed receipts/orders, adjustments if you add them later. "Every operation tied to selling" = traceability from **order/receipt → line items → amounts collected/outstanding**. |
| **AR / debits** | Lists **customers (or orders)** with **balance still owed**—aligned with existing "outstanding" / receipt payment concepts in admin analytics. |
| **Period reports** | **One-click** report for **this day / this week / this month** (and optionally custom range). |
| **PDF export** | Same period content exported as **PDF** (and optionally CSV for spreadsheets). Reports should be **analytical**: totals, by client, by order status, in vs out, trends for the period—not only raw tables. |
| **Deep analysis** | Narrative sections the PDF can include: opening/closing indicators for the period (if data supports), concentration (top debtors), aging-style buckets if you add due dates consistently, collection rate—built on **existing APIs + aggregated queries**. |

**Technical note:** Today the system centers on **receipts, orders, clients, payments**. True "all cash out" (payroll, suppliers) may **not** exist as first-class data yet—phase 1 can scope **cash in + customer receivables** from current schema; "outgoing" expands when you model expenses or payroll movements.

---

## 2. Reports reaching the admin (accountant → admin)

**Requirement:** Accountant can **submit** or **publish** a report so **admin** sees it in one place.

**Patterns to choose:**

- **A)** Each generated PDF is stored (S3/disk) with metadata; admin sees a **list + download**.  
- **B)** "Send to admin" creates an **approval/submission record** (see section 4) with attachment + summary line.  

Both can coexist: **generate PDF** + **submit to admin queue** as one flow.

---

## 3. Salary change approval: admin only (policy change)

**Current behavior (approx.):** Salary increase requests can be decided by **HR or admin** in API/UI.

**Target behavior:**

| Request type | Who approves |
|--------------|----------------|
| **Salary increase / base pay change** | **Admin only** (sensitive). HR can **prepare** or **recommend** but **cannot** finalize. |
| **Annual / sick leave** (non-monetary caps) | **HR** can continue to approve (as today), unless you later add rules. |

**Implementation direction:** New status or step, e.g. `pending_admin` after HR review, or **HR never approves salary**—only **admin** `decide` endpoint for salary requests. Coordinate with notifications so HR and employee see state transitions.

---

## 4. Unified admin section: one inbox for "everything that needs admin"

**Purpose:** Single **admin dashboard area** where leadership sees:

- Pending **salary** approvals (from HR/employees).  
- **Accountant** submissions: PDF reports, period summaries, optional comments.  
- **Supervisor → admin** requests (type TBD: budgets, exceptions, headcount, etc.—product decision).  
- **HR → admin** items that need signature/approval (contracts, policy exceptions, etc.—currently may be placeholders).  
- Any other **employee → admin** approval pipelines you add later.

**UX concept:**

- **One queue** (sortable/filterable): type (salary, finance report, HR paper, supervisor request), from whom, date, status.  
- **Detail pane:** open attachment (PDF), approve/reject/request more info, optional note.  
- **No duplicate scattered pages** for each role—**one calendar-style or list-style home** for admin daily use.

**Data model (generic approach):** A table e.g. `admin_submissions` or `approval_requests` with: `type`, `submitted_by`, `payload` (JSON), `attachment_path`, `status`, `decided_by`, `decided_at`, `notes`. Specialized flows (salary) can **also** update domain tables on `approved`.

---

## 5. Data the admin "sees every day"

**Goal:** Admin opens **one place** and understands:

- What's **waiting for my signature/approval**.  
- **Finance snapshot** (optional widget): today's receipts, outstanding debtors—may overlap accountant dashboard or link out.  
- **Escalations** without opening HR Center or accountant tools separately.

This can be the **same page** as the unified inbox, with **widgets** for high-level numbers.

---

## 6. Suggested implementation phases (for engineering)

1. **Policy + API:** Route salary decisions to **admin only**; migrate in-flight requests; notify HR/employee.  
2. **Generic submission model + admin UI:** CRUD + list/detail + approve/reject for generic types; accountant "attach PDF + submit".  
3. **Accountant dashboard:** Period filters, cash-in/receivables views, **PDF generation** (e.g. Dompdf / Snappy / front-end print-to-PDF).  
4. **Deeper cash-flow** if you add **expense/outflow** entities later.  
5. **Supervisor/HR specific forms** mapped into the same submission types.

---

## 7. Glossary / wording

- **"Ceiling"** in the conversation is treated as **sale / receipt / settlement**—money events tied to customer orders; exact naming in UI should match your business (Arabic/English).  
- **Debits / people who have not paid** = **accounts receivable** / outstanding balances already aligned with **client + receipt payment** concepts.

---

## 8. Open product questions (decide before build)

- Should **accountant** be read-only on money fields or able to **post adjustments** (with audit)?  
- Should **two-step** salary (HR recommends → admin approves) exist, or **employee → admin only**?  
- Which **supervisor → admin** request types are in scope for v1?
