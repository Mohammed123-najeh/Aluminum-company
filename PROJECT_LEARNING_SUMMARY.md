# Aluminum Pearl Co. — Project Learning Summary

> A deep, exhaustive learning resource describing the architecture, features, libraries, file structure, and implementation techniques used in the **Aluminum Pearl Co. Management System**. This document is intended as the source material for generating a comprehensive learning PDF.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack Summary](#2-tech-stack-summary)
3. [Repository Structure](#3-repository-structure)
4. [Backend (Laravel 12) — Deep Dive](#4-backend-laravel-12--deep-dive)
5. [Frontend (React 19 + Vite + TypeScript) — Deep Dive](#5-frontend-react-19--vite--typescript--deep-dive)
6. [Database Schema](#6-database-schema)
7. [Features Catalogue](#7-features-catalogue)
8. [Cross-Cutting Techniques](#8-cross-cutting-techniques)
9. [Workflow Examples (End-to-End Traces)](#9-workflow-examples-end-to-end-traces)
10. [How to Run the Project](#10-how-to-run-the-project)
11. [Glossary of Patterns](#11-glossary-of-patterns)

---

## 1. Project Overview

**Aluminum Pearl Co.** is a full-stack ERP (Enterprise Resource Planning) system for an aluminum factory. It manages:

- Users with **multiple roles** (Admin, Supervisor, Employee) and **employee sub-types** (HR, Accountant, Sales).
- **Tasks** assigned by supervisors to employees, with attachments and status tracking.
- **Orders** (with inventory items, payments, receipts) linked to clients and tasks.
- **Inventory / Storehouse** (aluminum profiles + color codes + quantities + pricing).
- **Clients** (customer database per supervisor).
- **Internal messaging** between users (peer-to-peer).
- **HR workflows**: leave requests, salary increase requests, salary advance (debit) requests.
- **Attendance tracking** (auto clock-in/out on login/logout).
- **Financial analytics** (cash flow, aging reports, trends, debit tracking).
- **PDF receipt generation** (DomPDF).
- **AI integration** (OpenAI chat, task text generation, daily summarization).
- **In-app notifications** with deep links.
- **Bilingual UI** (English + Arabic) with RTL support.
- **Dark mode** toggle.

The system is a **monorepo** containing `backend/` (Laravel API) and `frontend/` (React SPA) folders.

---

## 2. Tech Stack Summary

### Backend
| Category | Technology |
|---|---|
| Language | PHP 8.2+ |
| Framework | Laravel 12 |
| Authentication | Laravel Sanctum (token-based) |
| ORM | Eloquent |
| Database (default) | SQLite (configurable to MySQL/PostgreSQL) |
| PDF Generation | barryvdh/laravel-dompdf 3.1 |
| AI | OpenAI API (via custom service) |
| Testing | PHPUnit 11 |
| Code Style | Laravel Pint |
| Dev Tooling | Laravel Sail (Docker), Tinker |

### Frontend
| Category | Technology |
|---|---|
| Language | TypeScript ~5.9 (strict mode) |
| Library | React 19.2 |
| Build Tool | Vite 8 |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| Routing | **None** (role-based conditional rendering) |
| State Management | React Context + Custom Hooks (no Redux/Zustand) |
| HTTP Client | Native `fetch` (custom wrapper) |
| i18n | Custom object-based dictionary (en/ar) |
| Forms | Controlled components (no library) |

### Communication
- **Stateless REST API** over JSON.
- Bearer tokens (`Authorization: Bearer <sanctum_token>`) on every protected request.
- Dev: Vite proxies `/api` → `http://127.0.0.1:8001`.

---

## 3. Repository Structure

```
ALumnuim_project/
├── backend/                        # Laravel 12 API
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/       # 23 controllers
│   │   │   └── Middleware/
│   │   ├── Models/                # 21 Eloquent models
│   │   ├── Services/              # OpenAiChatService, InAppNotifier, ...
│   │   ├── Support/               # InventoryPricing, ReceiptPaymentAnalytics
│   │   ├── Mail/                  # PasswordResetCodeMail, ...
│   │   ├── Notifications/
│   │   ├── Jobs/
│   │   ├── Events/
│   │   ├── Exceptions/
│   │   └── Providers/
│   ├── bootstrap/app.php          # Laravel 11/12 modern bootstrap
│   ├── config/                    # auth.php, cors.php, openai.php, ...
│   ├── database/
│   │   ├── migrations/            # 37 migrations
│   │   ├── seeders/               # AdminSeeder, InventoryStockSeeder, ...
│   │   └── factories/
│   ├── routes/api.php             # All API routes
│   ├── composer.json
│   └── .env
│
├── frontend/                       # React 19 + Vite + TypeScript
│   ├── src/
│   │   ├── components/
│   │   │   ├── admin/             # Admin role UI
│   │   │   ├── supervisor/        # Supervisor role UI
│   │   │   ├── employee/          # Employee role UI
│   │   │   ├── hr/                # HR-typed employee UI
│   │   │   ├── accountant/        # Accountant-typed employee UI
│   │   │   ├── ai/                # AI chat panel
│   │   │   ├── clients/
│   │   │   ├── notifications/
│   │   │   ├── shared/            # Cross-role reusable components
│   │   │   └── LoginForm.tsx
│   │   ├── pages/                 # 3 role-based entry pages
│   │   │   ├── AdminPage.tsx
│   │   │   ├── SupervisorPage.tsx
│   │   │   └── EmployeePage.tsx
│   │   ├── hooks/                 # 8 custom data-hooks
│   │   ├── services/api.ts        # All API endpoint functions
│   │   ├── contexts/AppContext.tsx
│   │   ├── i18n/translations.ts
│   │   ├── types/user.ts
│   │   ├── utils/                 # currency.ts, taskDates.ts
│   │   ├── constants/
│   │   ├── main.tsx               # Entry: role-based routing
│   │   ├── LoginPage.tsx
│   │   └── style.css              # Tailwind import
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── docs/
└── README.md
```

---

## 4. Backend (Laravel 12) — Deep Dive

### 4.1 Controllers — Full List

Located in `backend/app/Http/Controllers/`:

| Controller | Purpose |
|---|---|
| **AuthController** | Login, logout, password verification, `me` endpoint. Manages Sanctum tokens and attendance shifts. |
| **PasswordResetController** | Public, throttled password reset (forgot → verify → reset) using 6-digit email codes. |
| **UserController** | CRUD for users, role/status management, supervisor assignment. |
| **MyEmployeesController** | Supervisor's subordinate listing. |
| **AdminAnalyticsController** | Admin dashboard analytics. |
| **AdminApprovalsController** | Summary of pending approvals. |
| **AdminSubmissionController** | Generic submission workflow with file uploads. |
| **OrderController** | Order CRUD, payments, receipt metadata, payment status derivation. |
| **TaskController** | Task CRUD, attachments, many-to-many assignments. |
| **ClientController** | Client CRUD per supervisor; aggregates orders per client. |
| **StorehouseController** | Inventory CRUD, profiles, colors, categories. |
| **SalesTaskFulfillmentController** | Sales-specific fulfillment of tasks from inventory. |
| **MessageController** | Peer-to-peer messaging, thread summaries, unread counts. |
| **NotificationController** | In-app notifications list + read state. |
| **AccountantFinanceController** | Cash flow, aging report, overview, trend, debits, PDF receipt report. |
| **ReceiptPaymentAnalyticsController** | Receipts/payments analytics. |
| **HrAnalyticsController** | HR metrics, employee details. |
| **LeaveRequestController** | Multi-step leave workflow (Employee → Supervisor → HR). |
| **SalaryIncreaseRequestController** | Salary increase workflow (Employee → HR/Admin). |
| **EmployeeDebitRequestController** | Salary-advance workflow. |
| **AttendanceController** | Clock-in/out tracking, summaries, computed earnings. |
| **AiController** | OpenAI integration (chat, task text, summaries, sharing). |

### 4.2 Models — Full List

Located in `backend/app/Models/`:

| Model | Relationships | Notes |
|---|---|---|
| **User** | hasMany Task (supervisor), hasMany User (subordinates), belongsToMany Task (assigned), hasMany Message (sender/receiver) | Roles: admin/supervisor/employee. EmployeeType: accountant/sales/hr. |
| **Task** | belongsTo User (supervisor), belongsToMany User (assignees), hasMany TaskAttachment, belongsTo Order, belongsTo Client | Statuses: pending/in_progress/completed/cancelled. |
| **Order** | belongsTo User (creator, supervisor), belongsTo Client, hasMany OrderItem, hasMany OrderPayment, hasOne Task | Statuses: draft/submitted/in_progress/completed/cancelled. |
| **OrderItem** | belongsTo Order, belongsTo Profile, belongsTo Color | Line item with quantity and unit_price. |
| **OrderPayment** | belongsTo Order, belongsTo User (recorded_by) | Per-payment record. |
| **Client** | belongsTo User (supervisor), hasMany Task, hasMany Order | |
| **Inventory** | belongsTo Profile, belongsTo Color | Unique (profile_id, color_code). |
| **Profile** | hasMany Inventory, belongsTo ProductCategory | Aluminum profile SKUs. |
| **Color** | hasMany Inventory | Color codes (e.g., "WHITE-01"). |
| **ProductCategory** | hasMany Profile | E.g., "ALUMINUM", "ACCESSORIES". |
| **Message** | belongsTo User (sender, receiver), belongsTo Task | `read_at` nullable. |
| **UserNotification** | belongsTo User | `data` is JSON; `type` is one of ~15 constants. |
| **AttendanceLog** | belongsTo User | clock_in_at + clock_out_at + minutes_worked. |
| **LeaveRequest** | belongsTo User, belongsTo Supervisor | Workflow: pending → supervisor → hr → approved/rejected. |
| **SalaryIncreaseRequest** | belongsTo User | Workflow: pending → approved/rejected. |
| **EmployeeDebitRequest** | belongsTo User | Salary advance requests. |
| **AdminSubmission** | belongsTo User | Generic submission workflow with attachment. |
| **TaskAttachment** | belongsTo Task | File uploads on tasks. |
| **AiConversation** | belongsTo User, hasMany AiMessage | Shareable AI chat history. |
| **AiMessage** | belongsTo AiConversation | role + content. |
| **PasswordResetCode** | (none) | Hashed 6-digit code with TTL + attempts counter. |

### 4.3 Services & Support

`backend/app/Services/`:
- **OpenAiChatService** — Thin wrapper around the OpenAI chat completions endpoint.
- **AiContextBuilder** — Builds personalized prompt context from the current user's data.
- **InAppNotifier** — Static facade that writes `UserNotification` rows for events.
- **FinalizeDraftOrderForCompletedTask** — When a task is marked completed and has a draft order, this service finalizes it (pricing, totals, receipt number).

`backend/app/Support/`:
- **InventoryPricing** — Deterministic, hash-based unit pricing if `unit_price` is null.
- **ReceiptPaymentAnalytics** — Helpers for aggregating receipts/payments data.

### 4.4 Routes — `routes/api.php`

**Public routes** (registered in `bootstrap/app.php`):
- `POST /api/login`
- `POST /api/password/forgot` *(throttle: 6/min)*
- `POST /api/password/verify` *(throttle: 6/min)*
- `POST /api/password/reset` *(throttle: 6/min)*

**Protected routes** (all under `auth:sanctum`):

```php
Route::middleware('auth:sanctum')->group(function () {
    // ----- Auth -----
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // ----- Notifications -----
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::patch('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);

    // ----- Messaging -----
    Route::get('/messages', [MessageController::class, 'index']);
    Route::post('/messages', [MessageController::class, 'store']);

    // ----- Tasks (nested attachments) -----
    Route::get('/tasks', [TaskController::class, 'index']);
    Route::post('/tasks', [TaskController::class, 'store']);
    Route::patch('/tasks/{id}', [TaskController::class, 'update']);
    Route::delete('/tasks/{id}', [TaskController::class, 'destroy']);
    Route::post('/tasks/{id}/attachments', [TaskController::class, 'storeAttachment']);
    Route::delete('/tasks/{id}/attachments/{attachId}', [TaskController::class, 'destroyAttachment']);

    // ----- Inventory / Storehouse -----
    Route::get('/storehouse/categories', [StorehouseController::class, 'categories']);
    Route::get('/storehouse/profiles', [StorehouseController::class, 'profiles']);
    Route::patch('/storehouse/profiles/{id}', [StorehouseController::class, 'updateProfile']);
    Route::get('/storehouse/colors', [StorehouseController::class, 'colors']);
    Route::get('/storehouse/inventory', [StorehouseController::class, 'inventory']);
    Route::post('/storehouse/inventory', [StorehouseController::class, 'storeInventory']);
    Route::patch('/storehouse/inventory/{id}', [StorehouseController::class, 'updateInventory']);
    Route::delete('/storehouse/inventory/{id}', [StorehouseController::class, 'destroyInventory']);

    // ----- Clients -----
    Route::get('/clients', [ClientController::class, 'index']);
    Route::post('/clients', [ClientController::class, 'store']);
    Route::get('/clients/{id}', [ClientController::class, 'show']);
    Route::patch('/clients/{id}', [ClientController::class, 'update']);
    Route::delete('/clients/{id}', [ClientController::class, 'destroy']);

    // ----- Orders -----
    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);
    Route::get('/orders/{id}', [OrderController::class, 'show']);
    Route::put('/orders/{id}', [OrderController::class, 'update']);
    Route::patch('/orders/{id}/payment', [OrderController::class, 'updatePayment']);
    Route::get('/orders/{id}/payments', [OrderController::class, 'listPayments']);
    Route::post('/orders/{id}/payments', [OrderController::class, 'addPayment']);
    Route::patch('/orders/{id}/receipt-meta', [OrderController::class, 'updateReceiptMeta']);

    // ----- Users (admin scope) -----
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{id}', [UserController::class, 'update']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']);
    Route::patch('/users/{id}/toggle-status', [UserController::class, 'toggleStatus']);
    Route::patch('/users/{id}/assign-supervisor', [UserController::class, 'assignSupervisor']);

    // ----- Attendance, Analytics, Finance, Workflows, AI -----
    // ... see full listing above
    Route::post('/ai/chat', [AiController::class, 'chat'])->middleware('throttle:30,1');
    Route::post('/ai/task-text', [AiController::class, 'taskText'])->middleware('throttle:20,1');
});
```

**Routing concepts taught:**
- Middleware grouping with `auth:sanctum`.
- Per-route throttling (`throttle:N,1` = N requests per minute).
- Nested resources (`/tasks/{id}/attachments`).
- RESTful + custom action endpoints mixed.

### 4.5 Bootstrap & Middleware — `bootstrap/app.php`

```php
return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            Route::post('/api/login', [AuthController::class, 'login'])->middleware('api');
            Route::middleware(['api', 'throttle:6,1'])->group(function () {
                Route::post('/api/password/forgot', [PasswordResetController::class, 'forgot']);
                Route::post('/api/password/verify', [PasswordResetController::class, 'verify']);
                Route::post('/api/password/reset',  [PasswordResetController::class, 'reset']);
            });
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {})
    ->withExceptions(function (Exceptions $exceptions): void {})
    ->create();
```

**Concept:** Laravel 11/12 bootstrap is a single fluent expression. The `then` callback lets you register public routes alongside the standard `api.php` (which is gated by Sanctum by default).

### 4.6 Authentication — `AuthController.php`

**Login Flow (combines auth + attendance tracking):**

```php
public function login(Request $request)
{
    $request->validate([
        'email'    => 'required|email',
        'password' => 'required|string',
    ]);

    $user = User::where('email', $request->email)->first();
    if (!$user || !Hash::check($request->password, $user->password)) {
        return response()->json(['message' => 'Invalid credentials'], 401);
    }

    // Single-session enforcement: revoke all old tokens
    $user->tokens()->delete();

    // Close any prior open attendance shift
    AttendanceLog::where('user_id', $user->id)
        ->whereNull('clock_out_at')
        ->get()
        ->each(function (AttendanceLog $log) {
            $log->clock_out_at = now();
            $log->minutes_worked = max(0, (int) $log->clock_in_at->diffInMinutes(now()));
            $log->save();
        });

    // Open a new shift (implicit clock-in)
    AttendanceLog::create([
        'user_id' => $user->id,
        'clock_in_at' => now(),
        'ip_address' => $request->ip(),
        'user_agent' => substr((string) $request->userAgent(), 0, 255),
    ]);

    $token = $user->createToken('auth_token')->plainTextToken;

    return response()->json([
        'token' => $token,
        'user'  => $user->toApiArray(),
    ]);
}
```

**Concepts taught:**
- `Hash::check()` for secure password verification.
- Sanctum's `createToken()` returns a `plainTextToken` — only shown once.
- Combining business logic (attendance) with auth events.
- Single-session enforcement via `$user->tokens()->delete()`.

**Logout flow** mirrors login: closes the open attendance log and deletes the current access token (`$user->currentAccessToken()->delete()`).

### 4.7 Password Reset Flow — `PasswordResetController.php`

Uses a 3-step process: **forgot → verify → reset**, each rate-limited (6 requests/min).

```php
// Step 1: forgot — generate 6-digit code, email it
$code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
PasswordResetCode::create([
    'email'      => $email,
    'code_hash'  => Hash::make($code),     // hashed like a password
    'expires_at' => now()->addMinutes(15),
    'ip_address' => $request->ip(),
    'attempts'   => 0,
]);
Mail::to($user->email)->send(new PasswordResetCodeMail($user->name, $code, 15));

// Step 2: verify — Hash::check the code, increment attempts, lockout after 5 fails
if ($record->attempts >= 5) {
    $record->consumed_at = now();
    return response()->json(['message' => 'Too many attempts'], 422);
}

// Step 3: reset — final password change + revoke all tokens
$user->password = Hash::make($newPassword);
$user->save();
$user->tokens()->delete();
$record->consumed_at = now();
```

**Concepts taught:**
- Codes are **hashed**, never stored in plaintext.
- Always return success on `/forgot` (prevents email enumeration).
- Rate-limited via Laravel's `throttle:6,1` middleware.
- Resetting password invalidates all existing sessions.

### 4.8 Orders & Payments — `OrderController.php`

**Role-scoped index query:**

```php
$query = Order::with([
    'items.profile.category', 'items.color',
    'creator:id,name', 'supervisor:id,name',
    'client:id,name,phone,email',
]);

if ($user->role === 'admin' || $user->isAccountant()) {
    // admin & accountant see all
} elseif ($user->role === 'supervisor') {
    $query->where(function ($q) use ($user) {
        $q->where('supervisor_id', $user->id)
          ->orWhere('creator_id', $user->id);
    });
} else {
    $query->where('creator_id', $user->id);
}
```

**Concepts:**
- Eager-loading nested relationships with dot notation: `items.profile.category`.
- Selective column loading (`creator:id,name`) cuts memory.
- Nested `where` closure for OR logic.

**Atomic payment update:**

```php
return DB::transaction(function () use ($order, $add, $data, $user) {
    OrderPayment::create([
        'order_id'    => $order->id,
        'amount'      => $add,
        'paid_at'     => isset($data['paid_at']) ? Carbon::parse($data['paid_at']) : now(),
        'recorded_by' => $user->id,
        'note'        => $data['note'] ?? null,
    ]);
    $order->amount_paid = round((float) ($order->amount_paid ?? 0) + $add, 2);
    $order->save();
    return response()->json($this->orderToArray($order->fresh()));
});
```

**Concept:** `DB::transaction()` wraps multiple writes — if anything fails, all roll back. Essential for money.

**Payment status derivation (pure static method on model):**

```php
public static function derivePaymentStatus(?float $total, ?float $paid): string
{
    if ($total === null || $total <= 0) return 'unknown';
    $p = $paid ?? 0;
    if ($p >= $total - 0.009) return 'paid';      // floating-point safe
    if ($p > 0.009) return 'partial';
    return 'unpaid';
}
```

**Concept:** Avoid storing derived state; recompute on read with floating-point-safe comparisons (`>= total - 0.009`).

### 4.9 Tasks & Assignments — `TaskController.php`

```php
public function store(Request $request)
{
    $user = $request->user();
    if ($user->role !== 'supervisor') {
        return response()->json(['message' => 'Only supervisors can create tasks'], 403);
    }

    $data = $request->validate([
        'assignee_ids'   => 'required|array',
        'assignee_ids.*' => 'exists:users,id',
        'title'          => 'required|string|max:255',
        'description'    => 'nullable|string|max:10000',
        'due_date'       => 'nullable|date',
    ]);

    // Authorize: every assignee must be a subordinate
    $subordinateIds = $user->subordinates()->pluck('id')->toArray();
    foreach ($data['assignee_ids'] as $id) {
        if (! in_array((int) $id, $subordinateIds)) {
            return response()->json(['message' => 'All assignees must be your employees'], 403);
        }
    }

    $task = Task::create([...]);
    $task->assignees()->sync($data['assignee_ids']);       // many-to-many
    $task->load('assignees:id,name,email');

    foreach ($task->assignees as $assignee) {
        InAppNotifier::taskAssigned($assignee, $task, $user->name);
    }

    return response()->json($this->taskToArray($task->fresh()), 201);
}
```

**Concepts:**
- Nested array validation (`assignee_ids.*`).
- `belongsToMany().sync()` replaces the entire pivot set.
- Bulk authorization with `pluck()` for in-memory checks.
- Event-after-write: notify each assignee.

### 4.10 Messaging — `MessageController.php`

**Bidirectional thread query:**

```php
$messages = Message::with(['sender', 'receiver', 'task'])
    ->where(function ($q) use ($user, $receiverId) {
        $q->where('sender_id', $user->id)->where('receiver_id', $receiverId)
          ->orWhere('sender_id', $receiverId)->where('receiver_id', $user->id);
    })
    ->orderBy('created_at')
    ->get();

// Auto-mark received messages as read on thread open
Message::query()
    ->where('sender_id', $receiverId)
    ->where('receiver_id', $user->id)
    ->whereNull('read_at')
    ->update(['read_at' => now()]);
```

**Concept:** Bulk update with `whereNull()` filter — far better than fetch-modify-save.

### 4.11 Inventory Pricing — `InventoryPricing.php`

```php
class InventoryPricing
{
    public static function unitPrice(Inventory $inv): float
    {
        if ($inv->unit_price !== null) {
            return round((float) $inv->unit_price, 2);
        }
        // Deterministic price from id + color + profile
        $hash = crc32((string) $inv->id . '|' . $inv->color_code . '|' . $inv->profile_id);
        $base = 45 + ($hash % 220);             // 45–265
        return round($base + ($hash % 100) / 100, 2);
    }
}
```

**Concept:** Deterministic defaults via hashing — same input always yields same output, without storing it in the DB.

### 4.12 In-App Notifier — `InAppNotifier.php`

```php
class InAppNotifier
{
    public static function messageReceived(User $receiver, Message $message): void
    {
        $message->loadMissing('sender:id,name');
        UserNotification::create([
            'user_id' => $receiver->id,
            'type'    => UserNotification::TYPE_MESSAGE,
            'title'   => 'New message from ' . ($message->sender?->name ?? 'Someone'),
            'body'    => Str::limit(strip_tags($message->body), 120),
            'data'    => [
                'messageId' => (string) $message->id,
                'peerId'    => (string) $message->sender_id,
            ],
        ]);
    }

    public static function taskAssigned(User $assignee, Task $task, string $supervisorName): void { ... }
    public static function leaveRequestSubmitted(LeaveRequest $leave): void { ... }
    public static function leaveRequestAwaitingHr(LeaveRequest $leave): void { ... }
    public static function leaveRequestDecided(User $employee, LeaveRequest $leave): void { ... }
    // ... debitRequestSubmitted, salaryRequestDecided, adminSubmissionPending, welcome, etc.
}
```

**Concepts:**
- Static facade pattern keeps callsites short (`InAppNotifier::taskAssigned(...)`).
- All notifications share the same DB table; differentiated by `type` constants.
- `data` is JSON — enables deep-linking from the bell into the right route on the frontend.

### 4.13 Leave Workflow — `LeaveRequestController.php`

State machine: **pending** → (supervisor decides) → **pending (hr step)** → (hr decides) → **approved / rejected / cancelled**.

```php
$workflowStep = $supervisorId ? 'supervisor' : 'hr';

$leave = LeaveRequest::create([
    'user_id'        => $user->id,
    'supervisor_id'  => $supervisorId,
    'workflow_step'  => $workflowStep,
    'type'           => $data['type'],          // holiday | sick
    'start_date'     => $start->toDateString(),
    'end_date'       => $end->toDateString(),
    'days_count'     => $days,
    'status'         => 'pending',
]);

if ($workflowStep === 'supervisor') {
    InAppNotifier::leaveRequestSubmitted($leave->fresh(['user:id,name']));
} else {
    InAppNotifier::leaveRequestAwaitingHr($leave->fresh(['user:id,name']));
}
```

**Concept:** Explicit `workflow_step` column drives both UI and routing of approvals — easy to reason about, easy to query.

### 4.14 Finance Aging Report — `AccountantFinanceController.php`

```php
foreach ($orders as $o) {
    $balance = round(max(0, (float) $o->total_amount - (float) ($o->amount_paid ?? 0)), 2);
    $due = $o->payment_due_at;

    $daysOverdue = $due ? $due->copy()->endOfDay()->diffInDays($now, false) : 0;
    $bucketKey = match (true) {
        $daysOverdue <= 0   => 'notDue',
        $daysOverdue <= 30  => 'd0_30',
        $daysOverdue <= 60  => 'd31_60',
        $daysOverdue <= 90  => 'd61_90',
        default             => 'd90_plus',
    };

    $buckets[$bucketKey]['count']++;
    $buckets[$bucketKey]['outstanding'] += $balance;
    $buckets[$bucketKey]['orders'][] = [/* ... */];
}
```

**Concepts:**
- PHP 8 `match` for tidy bucket selection.
- In-memory aggregation when SQL grouping is awkward.
- `diffInDays(..., false)` returns a **signed** integer.

### 4.15 Attendance Summary — `AttendanceController.php`

```php
$rows = $users->map(function (User $u) use ($byUser) {
    $entries = $byUser->get($u->id, collect());
    $totalMinutes = (int) $entries->sum(function ($l) {
        return $l->minutes_worked
            ?? ($l->clock_out_at ? max(0, $l->clock_in_at->diffInMinutes($l->clock_out_at)) : 0);
    });
    $totalHours = round($totalMinutes / 60, 2);
    $rate = $u->hourly_rate !== null ? (float) $u->hourly_rate : null;
    $earned = $rate !== null ? round($totalHours * $rate, 2) : null;
    return [
        'userId' => (string) $u->id,
        'totalHours' => $totalHours,
        'computedEarnings' => $earned,
        // ...
    ];
});
```

**Concept:** Collection `map()` + `groupBy()` produce report data in memory without complex SQL aggregations.

### 4.16 AI Integration — `AiController.php`

The AI controller calls **OpenAiChatService** with the configured key (from `.env`). It supports:
- Task text generation (improve title, generate description, translate to Arabic).
- Free-form chat with conversation persistence (`AiConversation` + `AiMessage`).
- Conversation sharing via a public token (`/api/ai/shared/{token}`).
- Daily summary generation.

All endpoints are throttled (20–30 requests/min).

### 4.17 Models — Key Techniques

**User model — casts and scopes:**

```php
protected function casts(): array
{
    return [
        'password' => 'hashed',                  // auto-hash on assignment
        'last_login_at' => 'datetime',
        'base_salary' => 'decimal:2',
        'annual_leave_balance' => 'decimal:1',
    ];
}

public static function hrRecipients(): Builder
{
    return static::query()
        ->where('role', 'employee')
        ->where('employee_type', 'hr')
        ->where('status', 'active');
}
```

**UserNotification — type constants + JSON array cast:**

```php
class UserNotification extends Model
{
    public const TYPE_MESSAGE = 'message';
    public const TYPE_TASK_ASSIGNED = 'task_assigned';
    public const TYPE_TASK_STATUS = 'task_status';
    public const TYPE_HR_LEAVE_PENDING = 'hr_leave_pending';
    public const TYPE_HR_LEAVE_DECIDED = 'hr_leave_decided';
    // ... 15+ types

    protected function casts(): array
    {
        return [
            'data'    => 'array',          // JSON ↔ PHP array
            'read_at' => 'datetime',
        ];
    }
}
```

### 4.18 Validation Strategy

All validation is **inline** in controllers using `$request->validate([...])`. No FormRequest classes.

Example with nested validation:

```php
$data = $request->validate([
    'items'              => 'required|array|min:1',
    'items.*.profile_id' => 'required|exists:profiles,id',
    'items.*.color_code' => 'required|exists:colors,color_code',
    'items.*.quantity'   => 'required|integer|min:1',
    'task_id'            => 'nullable|exists:tasks,id',
]);
```

### 4.19 API Response Shape

There are **no API Resource classes**. Each model has a custom `toApiArray()` method that returns camelCase JSON-friendly arrays. Reasoning: simpler, no transformation layer to maintain.

```php
public function toApiArray(): array
{
    return [
        'id'          => (string) $this->id,
        'name'        => $this->name,
        'role'        => $this->role,
        'baseSalary'  => $this->base_salary !== null ? (string) $this->base_salary : null,
        'lastLogin'   => $this->last_login_at?->toISOString(),
        'createdAt'   => $this->created_at->toISOString(),
    ];
}
```

---

## 5. Frontend (React 19 + Vite + TypeScript) — Deep Dive

### 5.1 `package.json`

```json
{
  "dependencies": {
    "react": "^19.2.4",
    "react-dom": "^19.2.4"
  },
  "devDependencies": {
    "vite": "^8.0.0",
    "typescript": "~5.9.3",
    "tailwindcss": "^4.2.1",
    "@tailwindcss/vite": "^4.2.1",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

**Notable:**
- **No router**: no `react-router-dom`.
- **No state library**: no Redux, Zustand, MobX, React Query, SWR.
- **No HTTP library**: no axios — uses native `fetch`.
- **No form library**: no React Hook Form, no Formik.
- **No i18n library**: no react-intl, no i18next.

This is a **deliberate minimalism** — the team chose to write thin abstractions over native browser APIs.

### 5.2 `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_PROXY_TARGET ?? 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
    },
  },
});
```

**Concept:** Vite's dev proxy forwards `/api/*` to Laravel — frontend code uses relative `/api` paths in dev, full URLs in prod (resolved by `VITE_API_BASE_URL`).

### 5.3 `tsconfig.json` — Strict TypeScript

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}
```

**Concept:** Strict mode + extra checks catch entire classes of bugs at compile time (unused variables, missing switch cases, side-effecting imports).

### 5.4 Entry Point — `src/main.tsx`

The whole app is mounted by `main.tsx` which:
1. Reads `auth_token` from localStorage.
2. Calls `auth.me(token)` to validate session.
3. Routes to the correct page based on `currentUser.role`.

```tsx
const App: React.FC = () => {
  const { token, setToken, currentUser, setAdminProfile, setCurrentUser } = useApp();
  const [loggedIn, setLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!token) { setLoggedIn(false); setChecking(false); return; }

    setChecking(true);
    auth.me(token)
      .then(user => {
        if (cancelled) return;
        setAdminProfile({ name: user.name, email: user.email });
        setCurrentUser(user);
        setLoggedIn(true);
      })
      .catch(() => {
        if (cancelled) return;
        setToken(null);
        setCurrentUser(null);
        setLoggedIn(false);
      })
      .finally(() => { if (!cancelled) setChecking(false); });

    return () => { cancelled = true; };
  }, [token, setToken, setAdminProfile, setCurrentUser]);

  if (checking) return <LoadingSpinner />;
  if (!loggedIn) return <LoginPage onLoginSuccess={() => setLoggedIn(true)} />;

  if (currentUser?.role === 'supervisor') return <SupervisorPage onLogout={handleLogout} />;
  if (currentUser?.role === 'employee')   return <EmployeePage   onLogout={handleLogout} />;
  return <AdminPage onLogout={handleLogout} />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>,
);
```

**Concepts taught:**
- The **cancellation token** pattern (`let cancelled = false`) avoids setState on unmounted components when `useEffect` re-runs.
- Role-based rendering is just a chain of `if` statements — no Router required.
- `<React.StrictMode>` double-invokes effects in dev for catching bugs.
- `<AppProvider>` wraps everything to expose global context.

### 5.5 Global Context — `src/contexts/AppContext.tsx`

```tsx
type AppContextType = {
  token: string | null;
  setToken: (t: string | null) => void;
  currentUser: ApiUser | null;
  setCurrentUser: (u: ApiUser | null) => void;
  adminProfile: AdminProfile;
  lang: Lang;                    // 'en' | 'ar'
  theme: Theme;                  // 'light' | 'dark'
  t: (key: TKey) => string;      // type-safe translation
  setLang: (l: Lang) => void;
  toggleTheme: () => void;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(() =>
    localStorage.getItem('auth_token'),
  );

  const setToken = useCallback((t: string | null) => {
    setTokenState(t);
    if (t) localStorage.setItem('auth_token', t);
    else   localStorage.removeItem('auth_token');
  }, []);

  const [lang, setLang] = useState<Lang>(() =>
    (localStorage.getItem('lang') as Lang) ?? 'en',
  );

  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem('theme') as Theme) ?? 'light',
  );

  // Side effect: apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    theme === 'dark' ? root.classList.add('dark') : root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Side effect: apply dir + lang attributes for RTL support
  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    localStorage.setItem('lang', lang);
  }, [lang]);

  const t = (key: TKey): string => translations[lang][key] ?? key;
  const toggleTheme = () => setTheme(p => p === 'light' ? 'dark' : 'light');

  return (
    <AppContext.Provider value={{ token, setToken, currentUser, setCurrentUser, lang, theme, t, setLang, toggleTheme, adminProfile, setAdminProfile }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
};
```

**Concepts taught:**
- **Lazy state initializer** (`useState(() => localStorage.getItem(...))`) — runs only on mount.
- **localStorage sync side-effects** in `useEffect` — declarative & cleanup-safe.
- **`useCallback`** for stable setter references (prevents downstream re-renders).
- **Type-safe `t()`** via `keyof typeof translations.en`.
- **Custom hook (`useApp`)** that throws if used outside the provider.
- **RTL support** is just setting `document.documentElement.dir = 'rtl'` — Tailwind 4's logical properties (`me-2`, `ms-4`, `text-start`) flip automatically.

### 5.6 API Service Layer — `src/services/api.ts`

**Base URL resolution:**

```ts
function resolveApiBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '').trim();
  if (!raw) {
    return import.meta.env.DEV ? '/api' : 'http://localhost:8000/api';
  }
  return `${raw.replace(/\/api$/i, '')}/api`;
}
const BASE = resolveApiBase();
```

**Generic typed request helper:**

```ts
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the API server.');
  }

  const text = await res.text();
  const data = parseJsonSafe(text);

  if (!res.ok) {
    const msgFromBody = data?.message ?? null;
    const firstValidation = Object.values(data?.errors ?? {}).flat()[0];
    throw new Error(msgFromBody ?? firstValidation ?? `HTTP ${res.status}`);
  }
  return data as T;
}
```

**Concepts taught:**
- TypeScript **generics** (`<T>`) for type-safe responses.
- **Bearer token injection** centralized — every API call gets it automatically.
- **Resilient error extraction** (Laravel's `{ message, errors: { field: [...] } }` shape).
- Try/catch around `fetch` catches network errors specifically.

**Domain API groups:**

```ts
export const tasksApi = {
  list: (token: string, params?: { assignee_id?: string; status?: string }) => {
    const search = new URLSearchParams();
    if (params?.assignee_id) search.set('assignee_id', params.assignee_id);
    if (params?.status) search.set('status', params.status);
    const q = search.toString();
    return request<ApiTask[]>('GET', q ? `/tasks?${q}` : '/tasks', undefined, token);
  },
  create: (payload: CreateTaskPayload, token: string) =>
    request<ApiTask>('POST', '/tasks', payload, token),
  update: (id: string, payload: UpdateTaskPayload, token: string) =>
    request<ApiTask>('PATCH', `/tasks/${id}`, payload, token),
  delete: (id: string, token: string) =>
    request<void>('DELETE', `/tasks/${id}`, undefined, token),
};

export const auth = {
  login:    (email: string, password: string) => request<{ token: string; user: ApiUser }>('POST', '/login', { email, password }),
  me:       (token: string) => request<ApiUser>('GET', '/me', undefined, token),
  logout:   (token: string) => request<{ message: string }>('POST', '/logout', undefined, token),
};
```

**Concept:** Each domain has its own object — easy to discover, easy to mock in tests.

### 5.7 Custom Hooks Pattern

There are 8 hooks in `src/hooks/`:
- `useAdminAnalytics`
- `useMessages`
- `useMyEmployees`
- `useNotifications`
- `useOrders`
- `useStorehouse`
- `useTasks`
- `useUsers`

**Common pattern (taught via `useStorehouse`):**

```tsx
export function useStorehouse(categoryCode?: string) {
  const { token } = useApp();
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [profiles,   setProfiles]   = useState<ApiProfile[]>([]);
  const [colors,     setColors]     = useState<ApiColor[]>([]);
  const [inventory,  setInventory]  = useState<ApiInventoryItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  // Spinner only on first load, not on refetches
  const loadedOnceRef = useRef(false);
  useEffect(() => { loadedOnceRef.current = false; }, [token, categoryCode]);

  const fetch = useCallback(async () => {
    if (!token) return;
    const showLoading = !loadedOnceRef.current;
    if (showLoading) setLoading(true);
    try {
      setError(null);
      // Parallel fetch — 4× faster than sequential
      const [cats, profs, cols, inv] = await Promise.all([
        storehouseApi.categories(token),
        storehouseApi.profiles(token, categoryCode),
        storehouseApi.colors(token),
        storehouseApi.inventory(token),
      ]);
      setCategories(cats); setProfiles(profs); setColors(cols); setInventory(inv);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
      loadedOnceRef.current = true;
    }
  }, [token, categoryCode]);

  useEffect(() => { fetch(); }, [fetch]);

  // Optimistic mutation: update local state after API succeeds
  const createInventoryItem = useCallback(async (payload: CreateInventoryPayload) => {
    if (!token) return;
    const created = await storehouseApi.inventoryCreate(payload, token);
    setInventory(prev =>
      [...prev, created].sort((a, b) =>
        a.profileCode.localeCompare(b.profileCode) ||
        a.colorCode.localeCompare(b.colorCode),
      ),
    );
    return created;
  }, [token]);

  return { categories, profiles, colors, inventory, loading, error, refetch: fetch, createInventoryItem };
}
```

**Concepts taught:**
- `useRef` + boolean flag for **conditional loading UI** (suppress spinner on refetch).
- `Promise.all` for **parallel API calls**.
- **Optimistic updates** — update local state after the API confirms.
- Returning `refetch` lets consumers re-trigger the load on demand.

### 5.8 Polling Strategies — `useNotifications.ts` & `useTasks.ts`

**Polling with mounted guard:**

```tsx
const POLL_MS = 45_000;
const mounted = useRef(true);

useEffect(() => {
  mounted.current = true;
  return () => { mounted.current = false; };
}, []);

const refreshCount = useCallback(async () => {
  if (!token) return;
  try {
    const { count } = await notificationsApi.unreadCount(token);
    if (mounted.current) setUnreadCount(count);   // guarded setState
  } catch { /* ignore */ }
}, [token]);

useEffect(() => {
  if (!token) return;
  refreshCount();
  const id = window.setInterval(refreshCount, POLL_MS);
  return () => clearInterval(id);
}, [token, refreshCount]);
```

**Visibility-aware polling (don't waste battery on hidden tabs):**

```tsx
useEffect(() => {
  if (!token) return;
  pollRef.current = setInterval(() => {
    if (document.visibilityState === 'visible') fetchTasks();
  }, 45_000);
  return () => pollRef.current && clearInterval(pollRef.current);
}, [token, fetchTasks]);

// Refetch immediately when user returns to the tab
useEffect(() => {
  const onFocus = () => fetchTasks();
  window.addEventListener('focus', onFocus);
  return () => window.removeEventListener('focus', onFocus);
}, [fetchTasks]);
```

**Concept:** No WebSockets, no Pusher — polling every 45 s combined with `visibilitychange` and `focus` event listeners gives near-real-time UX at zero infrastructure cost.

### 5.9 Login Form — `src/components/LoginForm.tsx`

```tsx
const handleSubmit = async (event: React.FormEvent) => {
  event.preventDefault();
  setError(null);
  if (!identifier || !password) {
    setError(t('invalidCredentials')); return;
  }
  setLoading(true);
  try {
    const { token, user } = await auth.login(identifier, password);
    setToken(token);                              // saves to localStorage
    setAdminProfile({ name: user.name, email: user.email });
    setCurrentUser(user);
    setSuccess(true);
    setTimeout(() => onSuccess?.(), 600);         // small UX delay before redirect
  } catch (err) {
    setError(err instanceof Error ? err.message : t('invalidCredentials'));
  } finally {
    setLoading(false);
  }
};
```

**Concepts taught:**
- Controlled inputs (`value` + `onChange`).
- Separate `error` + `success` + `loading` states drive UI variants.
- Server errors are typed as `Error` and their `.message` shown directly to the user (no transformation needed since the API returns human-readable messages).

### 5.10 Page Composition — `src/pages/AdminPage.tsx`

```tsx
type View = 'users' | 'orgchart' | 'analytics' | 'financial' | 'payroll' | 'approvals' | 'messages' | 'assistant' | 'notifications';

const AdminPage: React.FC<Props> = ({ onLogout }) => {
  const { token, currentUser, t } = useApp();
  const [view, setView] = useState<View>('users');
  const goView = (v: View) => startTransition(() => setView(v));

  const { users, loading, createUser, updateUser, deleteUser } = useUsers();
  const messages = useMessages(selectedReceiverId);

  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r bg-slate-900">
        <NavItem label={t('userManagement')} active={view === 'users'}    onClick={() => goView('users')}    icon={<Icon name="users" />} />
        <NavItem label={t('analytics')}      active={view === 'analytics'} onClick={() => goView('analytics')} icon={<Icon name="chart" />} />
        <NavItem label={t('messages')}       active={view === 'messages'}  onClick={() => goView('messages')}  icon={<Icon name="mail" />} />
        {/* ... more nav items */}
      </aside>

      <main className="flex-1 overflow-auto">
        {view === 'users'      && <UserTable users={users} onEdit={...} />}
        {view === 'analytics'  && <AdminAnalytics />}
        {view === 'messages'   && <AdminMessages messages={messages} />}
        {/* ... etc */}
      </main>
    </div>
  );
};
```

**Concepts taught:**
- **Discriminated union type** for `View` — TypeScript ensures only valid values.
- **`startTransition`** marks the view-switch as a non-blocking update — React keeps the UI responsive while the new section renders.
- Sidebar `NavItem` is a reusable button component with `active` + `badge` props.
- All data comes from custom hooks (`useUsers`, `useMessages`) — page only orchestrates.

### 5.11 Role-Gated Sections — `src/pages/EmployeePage.tsx`

```tsx
const isHr         = currentUser?.employeeType === 'hr';
const isAccountant = currentUser?.employeeType === 'accountant';

// Auto-redirect if user tries to land on a section they can't access
useEffect(() => {
  if (!isHr && (section === 'hrCenter' || section === 'hrAnalytics')) {
    startTransition(() => setSection('overview'));
  }
}, [isHr, section]);

return (
  <>
    <NavItem label={t('tasks')} active={...} onClick={() => goSection('tasks')} />
    {isHr && <NavItem label={t('hrCenter')} active={...} onClick={() => goSection('hrCenter')} />}
    {isAccountant && <NavItem label={t('finance')} active={...} onClick={() => goSection('accountantFinance')} />}
  </>
);
```

**Concept:** Frontend authorization is **defense in depth** — the backend also enforces these rules, but hiding/redirecting on the frontend is cleaner UX.

### 5.12 Notification Bell — `src/components/notifications/NotificationBell.tsx`

```tsx
const [open, setOpen] = useState(false);
const rootRef = useRef<HTMLDivElement>(null);

// Click-outside-to-close
useEffect(() => {
  if (!open) return;
  const onDoc = (e: MouseEvent) => {
    if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
  };
  document.addEventListener('mousedown', onDoc);
  return () => document.removeEventListener('mousedown', onDoc);
}, [open]);

return (
  <div className="relative" ref={rootRef}>
    <button onClick={() => setOpen(o => !o)}>
      <svg>...</svg>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -end-1 rounded-full bg-rose-500 px-1.5 py-px text-[10px] text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
    {open && (
      <div className="absolute end-0 top-full z-[100] mt-2 w-80 rounded-lg border bg-white shadow-xl">
        {list.map(n => (
          <button key={n.id} onClick={() => handleItem(n)}>
            <p>{n.title}</p>
            <p className="text-sm text-slate-500">{n.body}</p>
          </button>
        ))}
      </div>
    )}
  </div>
);

const handleItem = async (n: ApiUserNotification) => {
  if (!n.readAt) await markRead(n.id);
  setOpen(false);
  if (n.type === 'message' && n.data.peerId) {
    onOpenMessagesWithPeer?.(n.data.peerId);
  } else if (n.type === 'task_assigned' || n.type === 'task_status') {
    onOpenTasks?.(n.data.taskId);
  }
};
```

**Concepts taught:**
- **Click-outside** detection via `useRef` + `mousedown` listener.
- **Deep-linking** from notification → relevant page via callback props.
- Logical positioning classes (`end-0`) flip in RTL automatically.

### 5.13 i18n — `src/i18n/translations.ts`

```ts
export const translations = {
  en: {
    companyNameEn: 'Aluminum Pearl Co.',
    companyNameAr: 'شركة اللؤلؤة للألمنيوم',
    adminPanel: 'Admin Panel',
    userManagement: 'User Management',
    invalidCredentials: 'Invalid credentials',
    // ... ~300 keys
  },
  ar: {
    companyNameEn: 'Aluminum Pearl Co.',
    companyNameAr: 'شركة اللؤلؤة للألمنيوم',
    adminPanel: 'لوحة الإدارة',
    userManagement: 'إدارة المستخدمين',
    invalidCredentials: 'بيانات الاعتماد غير صحيحة',
    // ... same keys in Arabic
  },
};

export type Lang = 'en' | 'ar';
export type TKey = keyof typeof translations['en'];
```

```tsx
const { t, lang, setLang } = useApp();
return <h1>{t('adminPanel')}</h1>;
```

**Concept:** `TKey = keyof typeof translations.en` means `t('invalidd')` is a compile-time error. No external i18n library required for two languages.

### 5.14 Currency Formatting — `src/utils/currency.ts`

```ts
export const DISPLAY_CURRENCY = 'ILS' as const;
const ilsFormatter = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: DISPLAY_CURRENCY,
});
export const formatIls = (amount: number) => ilsFormatter.format(amount);
// formatIls(1500.5) → "‏1,500.50 ₪"
```

**Concept:** Built-in `Intl.NumberFormat` handles locale-aware currency formatting natively — no library needed.

### 5.15 Tailwind CSS v4

```css
/* src/style.css */
@import 'tailwindcss';
@custom-variant dark (&:where(.dark, .dark *));
```

That's the **entire** CSS file. Tailwind v4:
- No `tailwind.config.js` needed.
- Configured via the `@tailwindcss/vite` plugin.
- Uses Rust-based Lightning CSS — extremely fast builds.
- Dark mode via `class="dark"` on `<html>`.

**Color palette used throughout:** Slate (neutrals), Indigo (primary), Rose (errors/alerts), Emerald (success), Violet (AI accent).

### 5.16 Component Files (selection)

The codebase is ~68 TS/TSX files, ~20K LOC.

Largest/most instructive components:
- **AccountantFinancePanel.tsx** (~52 KB) — Finance dashboard with cash flow, aging, debit tracking.
- **TaskModal.tsx** (~28 KB) — Multi-step task editor with drag-drop assignees, AI helper, fulfillment cart.
- **EmployeeInventory.tsx** (~33 KB) — Inventory adjustments with filtering.
- **EmployeeSalesReceipts.tsx** (~28 KB) — Receipt list with PDF print.
- **StockTaskFulfillmentPanel.tsx** — Reusable cart UI shared between supervisor and employee modes (props control visibility of prices).
- **AiAssistantPanel.tsx** — Chat UI with `React.memo` rows and `useLayoutEffect` auto-scroll.

---

## 6. Database Schema

37 migrations create these primary tables (default driver: SQLite at `backend/database/database.sqlite`):

### Auth & Users
- `users` — id, name, email, password, role (admin/supervisor/employee), employee_type (accountant/sales/hr/null), main_job, base_salary, hourly_rate, annual_leave_balance, supervisor_id, status (active/suspended), last_login_at.
- `personal_access_tokens` — Sanctum tokens.
- `password_reset_codes` — email, code_hash, expires_at, consumed_at, attempts.

### Operations
- `tasks` — supervisor_id, title, description, status, due_date, completed_at, customer_name, customer_phone, order_id, client_id.
- `task_assignees` — pivot: task_id, user_id.
- `task_attachments` — task_id, file path, original name, size.
- `orders` — creator_id, supervisor_id, client_id, status, total_amount, amount_paid, payment_due_at, payment_notes, currency (ILS), receipt_number.
- `order_items` — order_id, profile_id, color_code, quantity, unit_price, line_total, notes.
- `order_payments` — order_id, amount, paid_at, recorded_by, note.
- `messages` — sender_id, receiver_id, task_id, body, read_at.
- `clients` — supervisor_id, accountant_created_by, name, phone, email, notes.

### Inventory
- `product_categories` — category_code, name.
- `profiles` — profile_id (SKU), category_code, name.
- `colors` — color_code, name.
- `inventory` — profile_id, color_code, quantity, unit_price. **Unique (profile_id, color_code).**

### HR Workflows
- `leave_requests` — user_id, supervisor_id, workflow_step (supervisor/hr), type (holiday/sick), start_date, end_date, days_count, status (pending/approved/rejected/cancelled), decided_by, decided_at, decision_note.
- `salary_increase_requests` — user_id, current_salary, requested_amount, reason, status, decided_by, decided_at.
- `employee_debit_requests` — user_id, amount, reason, status, decided_by.
- `admin_submissions` — submitted_by, type, status, attachment_path, decided_by, decision_note.
- `attendance_logs` — user_id, clock_in_at, clock_out_at, minutes_worked, ip_address, user_agent.

### AI & Notifications
- `ai_conversations` — user_id, title, share_token (nullable).
- `ai_messages` — conversation_id, role (user/assistant/system), content.
- `user_notifications` — user_id, type (string constant), title, body, data (JSON), read_at.

### System
- `cache` — Laravel cache driver.
- `jobs` — queue jobs (sync by default).

---

## 7. Features Catalogue

### A. Authentication & Session
- Email + password login with bcrypt verification (`Hash::check`).
- Sanctum personal-access tokens.
- Implicit clock-in/out on login/logout (attendance auto-logged).
- 6-digit code password reset (email-based, hashed, 15-min TTL, 5-attempt lockout).
- Throttled public auth endpoints (`throttle:6,1`).

### B. Role-Based Access
- 3 roles: `admin`, `supervisor`, `employee`.
- Employee sub-types: `hr`, `accountant`, `sales`, `null`.
- Self-referential `supervisor_id` builds the org tree.
- Status: `active` / `suspended` (suspended cannot log in).
- Authorization is **manual in controllers** (no Policies/Gates).

### C. User & Team Management
- Admin: full CRUD on users, role/type/supervisor assignment, suspend/activate.
- Supervisor: read-only list of subordinates + edit limited fields.
- Org chart visualization (admin only).

### D. Task Management
- Supervisor creates tasks, assigns to one or more subordinates via `belongsToMany` pivot.
- Employees see only tasks they're assigned to.
- Statuses: pending → in_progress → completed; or cancelled.
- File attachments (Laravel filesystem).
- Optional link to a Client and an Order.
- On completion, auto-finalizes any linked draft order with pricing.

### E. Order & Receipt Management
- Multi-status lifecycle: draft → submitted → in_progress → completed → cancelled.
- Items by `profile_id` + `color_code` + quantity.
- Multi-currency display (default ILS, optional SAR).
- Auto-generated receipt numbers (`RCP-YYYY-#####`) on completion.
- Per-payment recording (`order_payments`).
- Floating-point-safe payment status: paid / partial / unpaid / unknown.
- PDF receipt generation (DomPDF).

### F. Inventory / Storehouse
- Three-tier hierarchy: Category → Profile → Inventory (Profile × Color).
- Optional explicit `unit_price`; falls back to deterministic CRC32-based pricing.
- Stock adjustments by employees.
- Filterable by category and color.

### G. Client Management
- Each supervisor owns their client list.
- Aggregates: total purchases, total paid, balance due across all client orders.
- Auto-backfill of `order.client_id` when stale.

### H. Internal Messaging
- Peer-to-peer chats restricted by role hierarchy.
- Threaded view + summaries with unread counts.
- Polling-based (no WebSockets); 45 s interval or focus event.
- Optional `task_id` association.

### I. HR Workflows
- **Leave Requests**: 2-step workflow (supervisor approve → HR approve). Annual balance check. Holiday vs sick.
- **Salary Increase Requests**: HR decides.
- **Employee Debit Requests**: Salary advance, HR decides.
- **Admin Submissions**: Generic workflow with file attachment for admin approval.

### J. Attendance & Payroll
- Logs created on login, closed on logout.
- Summary aggregates minutes_worked, totalHours.
- Auto-computed earnings = totalHours × hourly_rate.
- Date-range filtering.

### K. Analytics & Reporting
- Admin: user counts, role distribution, task completion.
- HR: per-employee metrics, payroll totals.
- Accountant: cash flow, aging buckets (notDue / 0-30 / 31-60 / 61-90 / 90+), trend analysis, debit tracking.
- PDF report generation (DomPDF).

### L. AI Assistant
- Free-form chat (server-stored conversations).
- Task title/description improver.
- Daily summarization.
- Conversation sharing via public token (read-only public URL).
- Imports a shared conversation as a new local conversation.
- All endpoints throttled (15–30 req/min).

### M. In-App Notifications
- All notification types share the `user_notifications` table.
- ~15 type constants (message, task_assigned, hr_leave_pending, etc.).
- JSON `data` enables deep-linking from the bell.
- Polling for unread count every 45 s.

### N. UX / Theming / i18n
- English + Arabic translations (~300 keys).
- RTL automatically when `lang === 'ar'`.
- Dark mode toggle (`<html class="dark">`).
- Tailwind CSS 4 (zero config, fast builds).

---

## 8. Cross-Cutting Techniques

### Backend Techniques (Laravel)

| Technique | Where Used |
|---|---|
| Sanctum token auth | `AuthController`, all protected routes |
| Eloquent relationships (hasMany, belongsTo, belongsToMany) | All models |
| Pivot tables via `sync()` | `Task::assignees` |
| Eager loading dot syntax `with(['items.profile.category'])` | `OrderController` |
| Casts: `decimal:2`, `array`, `datetime`, `hashed` | `User`, `UserNotification`, `Order` |
| `DB::transaction()` for atomic multi-write ops | `OrderController::addPayment`, `FinalizeDraftOrderForCompletedTask` |
| `lockForUpdate()` for race-free reads | `FinalizeDraftOrderForCompletedTask` |
| Static helper services | `InAppNotifier`, `InventoryPricing` |
| Inline validation (`$request->validate([])`) | All controllers |
| Nested-array validation rules (`items.*.profile_id`) | `OrderController::store` |
| Throttle middleware `throttle:N,1` | Auth, AI endpoints |
| Mail with Mailable classes | `PasswordResetCodeMail` |
| Carbon for date arithmetic | Everywhere |
| `Hash::make` / `Hash::check` | Auth, password reset |
| Custom `toApiArray()` per model (no Resource classes) | Every API-exposed model |
| Collection methods: `map`, `filter`, `groupBy`, `sum`, `pluck` | Aggregations, analytics |
| PHP 8 `match` expression | `AccountantFinanceController::aging` |
| Modern bootstrap (Laravel 11/12 style) | `bootstrap/app.php` |

### Frontend Techniques (React + TS)

| Technique | Where Used |
|---|---|
| Functional components + Hooks (no classes) | Everywhere |
| TypeScript strict mode + discriminated unions | `types/user.ts`, `View` types in pages |
| Context API for global state | `AppContext.tsx` |
| Custom hooks for data fetching | `useTasks`, `useStorehouse`, ... |
| `Promise.all` for parallel fetches | `useStorehouse`, `EmployeeRequestsPanel` |
| `useRef` + flag to suppress refetch spinners | All hooks |
| `mounted.current` guard for unmount safety | `useNotifications` |
| `useCallback` for stable function refs | Context setters |
| `useMemo` for expensive derivations | `AdminMessages` |
| `startTransition` for non-blocking view switches | `AdminPage`, `EmployeePage` |
| `useLayoutEffect` for pre-paint DOM updates | `AiAssistantPanel` scroll-to-bottom |
| Cancellation token pattern in effects | `main.tsx` session check |
| Visibility-aware polling (`document.visibilityState`) | `useTasks` |
| Window focus refetch | `useTasks` |
| Click-outside detection via `useRef` + `mousedown` | `NotificationBell` |
| Drag-and-drop HTML5 API | `TaskModal` assignees |
| `React.memo` for chat row optimization | `AiAssistantPanel` |
| Tailwind 4 utility-first styling | All components |
| Logical CSS properties (`ms-`, `me-`, `text-start`) for RTL | Everywhere |
| `Intl.NumberFormat` for currency | `utils/currency.ts` |
| Generic `request<T>()` API wrapper | `services/api.ts` |
| Type-safe i18n via `keyof typeof` | `AppContext.t()` |
| Lazy `useState` initializers reading localStorage | `AppContext` |

---

## 9. Workflow Examples (End-to-End Traces)

### A. User Logs In

1. **Frontend** — `LoginForm.tsx` calls `auth.login(email, password)`.
2. **API layer** — `request<T>` POSTs `/api/login` with JSON body.
3. **Backend** — `AuthController::login`:
   - Validates inputs.
   - Fetches user, verifies password with `Hash::check`.
   - Revokes any existing Sanctum tokens.
   - Closes any open attendance shift.
   - Creates a new `AttendanceLog` row.
   - Issues a new token via `createToken('auth_token')->plainTextToken`.
   - Returns `{ token, user }`.
4. **Frontend** — `LoginForm` calls `setToken(token)` (persists to localStorage) and `setCurrentUser(user)`.
5. **`main.tsx`** detects `loggedIn = true` and renders the page corresponding to `user.role`.

### B. Supervisor Creates a Task

1. Supervisor opens `SupervisorTasks` → clicks "New Task" → `TaskModal` opens.
2. Picks title, description, due date, drag-drops assignees from `SupervisorTeamTable`.
3. Optionally clicks "AI" to improve text → `aiApi.taskText(token, { field, mode, text })`.
4. Submits → `tasksApi.create(payload, token)` → `POST /api/tasks`.
5. **Backend** — `TaskController::store`:
   - Validates input.
   - Checks each assignee is a subordinate of this supervisor.
   - Creates `Task` row.
   - `$task->assignees()->sync($data['assignee_ids'])` writes pivot rows.
   - For each assignee, calls `InAppNotifier::taskAssigned(...)` (writes `UserNotification` row).
6. **Frontend** — `useTasks` returns the new task; the supervisor's UI updates immediately.
7. **Employees** — Their `useNotifications` hook polls every 45 s; they see a new notification badge within seconds.

### C. Employee Completes Task → Order Finalized

1. Employee opens the task → adds order items in a linked draft order → marks status = `completed`.
2. **Backend** — `TaskController::update`:
   - Sets `status = completed`, `completed_at = now()`.
   - Calls `FinalizeDraftOrderForCompletedTask` service.
3. **Service** (in a DB transaction with `lockForUpdate`):
   - Loads the draft `Order` and its `items`.
   - For each item, uses `InventoryPricing::unitPrice($inv)` to compute the price (deterministic).
   - Sums line totals → sets `order.total_amount`.
   - Generates `receipt_number` like `RCP-2026-00001`.
   - Sets `order.status = 'completed'`.
4. Notifies supervisor via `InAppNotifier`.

### D. Leave Request Workflow

1. Employee opens `EmployeeRequestsPanel` → fills form → `leaveRequestsApi.create(token, payload)`.
2. **Backend** — `LeaveRequestController::store`:
   - Computes days_count, checks annual_leave_balance.
   - If user has `supervisor_id` → `workflow_step = 'supervisor'`; else `'hr'`.
   - Notifies the supervisor (or all HR users).
3. Supervisor opens `SupervisorLeavePanel` → approves → `PATCH /api/leave-requests/{id}/supervisor-decide`.
4. **Backend** advances `workflow_step = 'hr'` and notifies all HR.
5. HR user (Employee with `employee_type = 'hr'`) opens `HrCenterPanel` → approves → `PATCH /api/leave-requests/{id}/decide`.
6. **Backend** sets `status = 'approved'`, decrements `user.annual_leave_balance`, notifies the employee.

### E. Accountant Receives Payment

1. Accountant opens `AccountantFinancePanel` → finds an outstanding order.
2. Calls `ordersApi.addPayment(orderId, { amount, paid_at, note })`.
3. **Backend** — `OrderController::addPayment`:
   - Computes remaining balance; caps amount.
   - In a `DB::transaction`:
     - Creates `OrderPayment` row.
     - Updates `order.amount_paid`.
   - Returns updated order.
4. **Frontend** — `useOrders` updates the local list; aging/cash-flow analytics auto-recompute on next view.

---

## 10. How to Run the Project

### Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed   # creates SQLite db + sample admin users
php artisan serve --port=8001
```

### Frontend

```bash
cd frontend
npm install
npm run dev                  # http://localhost:5173 → proxies /api to :8001
```

### Production Build

```bash
cd frontend
npm run build                # produces dist/
```

The backend can be deployed on any PHP 8.2+ host; the frontend `dist/` is static and can ship via Nginx, S3, Cloudflare Pages, etc.

---

## 11. Glossary of Patterns

### Laravel Patterns

| Pattern | One-line Definition |
|---|---|
| Sanctum tokens | API-friendly bearer tokens stored in `personal_access_tokens`. |
| Eloquent relationships | Methods on models that return `BelongsTo` / `HasMany` / `BelongsToMany`. |
| Eager loading | `Model::with('relation')` to prevent N+1 query problems. |
| Pivot tables | Many-to-many join tables managed by `belongsToMany().sync()`. |
| Casts | Auto-conversion of DB types to PHP types (`decimal:2`, `array`, `hashed`). |
| `toApiArray()` | Manual model-to-JSON transformation method (alternative to Resource classes). |
| `DB::transaction()` | Wraps writes in a transaction with automatic rollback. |
| `lockForUpdate()` | Pessimistic row lock during a transaction. |
| Form validation | `$request->validate([...])` with nested-array rules. |
| Inline authorization | `if ($user->role !== 'X') abort(403)` patterns. |
| Throttle middleware | `throttle:N,1` for rate limiting. |
| Static service classes | `InAppNotifier::taskAssigned(...)` style facades. |
| Workflow column | A `workflow_step` enum column drives multi-step approval logic. |
| Status constants | `Task::STATUS_PENDING` etc. for compile-time-checked enums. |
| Deterministic defaults | CRC32-hash based fallback values (no DB writes needed). |

### React / TypeScript Patterns

| Pattern | One-line Definition |
|---|---|
| Custom hook | A function starting with `use` that composes other hooks for reusable stateful logic. |
| Context provider | Wrap the tree with `<Provider value={...}>` to expose global state. |
| Discriminated union | A type union (`'admin' \| 'supervisor' \| 'employee'`) that narrows in `if` branches. |
| Generic function | `function request<T>()` returns typed results. |
| Lazy state init | `useState(() => readFromLocalStorage())` runs only once. |
| Cancellation token | `let cancelled = false` in useEffect to prevent post-unmount setState. |
| `useRef` mounted guard | Track mount status to skip setState on unmounted components. |
| Polling with visibility check | `setInterval` + `document.visibilityState === 'visible'`. |
| Window focus refetch | `window.addEventListener('focus', refetch)`. |
| Click-outside | `useRef` + `mousedown` listener that closes if click is outside. |
| Optimistic update | Update local state right after the API confirms success. |
| `startTransition` | Marks an update as non-urgent so React can keep the UI responsive. |
| Bearer injection | API helper auto-adds `Authorization: Bearer <token>` to every request. |
| Locale-aware formatting | `Intl.NumberFormat`, `Intl.DateTimeFormat` built into the browser. |
| Tailwind logical props | `ms-`, `me-`, `text-start` flip automatically in RTL. |

---

## End of Summary

This document is intended as the **source of truth** for generating the learning PDF. It covers:

- The **complete file structure** of both backend and frontend.
- **Every controller, model, service, hook, page, and component** with its purpose.
- **Real code snippets** demonstrating each major technique.
- **End-to-end workflow traces** so a learner can follow a request through the whole stack.
- A **glossary** for both Laravel and React patterns.
- **Library choices and rationale** so a learner understands not just *what* was used, but *why*.

Anyone reading this should be able to:

1. Understand the architecture at a high level.
2. Pick any feature and follow its implementation from UI → API → DB.
3. Recognize and reuse the patterns in their own projects.
4. Learn modern Laravel 12 + React 19 + Tailwind 4 + TypeScript practices through real examples.
