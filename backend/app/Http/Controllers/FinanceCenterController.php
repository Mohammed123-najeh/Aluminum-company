<?php

namespace App\Http\Controllers;

use App\Models\CustomerInvoice;
use App\Models\CustomerInvoiceItem;
use App\Models\EmployeeDebitRequest;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\FinanceTransaction;
use App\Models\Order;
use App\Models\OrderPayment;
use App\Models\PaymentVoucher;
use App\Models\PaymentVoucherAllocation;
use App\Models\ReceiptVoucher;
use App\Models\ReceiptVoucherAllocation;
use App\Models\Supplier;
use App\Models\SupplierInvoice;
use App\Models\SupplierInvoiceItem;
use App\Models\User;
use App\Models\WorkScheduleSetting;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class FinanceCenterController extends Controller
{
    private function gate(Request $request): ?\Illuminate\Http\JsonResponse
    {
        $user = $request->user();
        if (! $user || ! ($user->role === 'admin' || $user->isAccountant())) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        return null;
    }

    public function dashboard(Request $request)
    {
        if ($r = $this->gate($request)) return $r;

        // The dashboard runs a dozen aggregate queries; the figures are fine to be up
        // to a minute stale on a summary screen. Cache the assembled payload so rapid
        // re-opens / multiple viewers hit memory instead of recomputing every time.
        $payload = Cache::remember('finance.dashboard.v1', now()->addSeconds(60), function () {
            return $this->buildDashboardPayload();
        });

        return response()->json($payload);
    }

    private function buildDashboardPayload(): array
    {
        $now = Carbon::now();
        $monthStart = $now->copy()->startOfMonth();
        $today = $now->copy()->toDateString();
        $lastMonthStart = $now->copy()->subMonth()->startOfMonth();
        $lastMonthEnd = $now->copy()->subMonth()->endOfMonth();

        $revenueMonth = (float) FinanceTransaction::where('type', 'revenue')
            ->whereBetween('date', [$monthStart, $now])->sum('amount');
        $revenueLastMonth = (float) FinanceTransaction::where('type', 'revenue')
            ->whereBetween('date', [$lastMonthStart, $lastMonthEnd])->sum('amount');
        $revenueToday = (float) FinanceTransaction::where('type', 'revenue')->whereDate('date', $today)->sum('amount');
        $expensesMonth = (float) FinanceTransaction::where('type', 'payment')
            ->whereBetween('date', [$monthStart, $now])->sum('amount');
        $expensesLastMonth = (float) FinanceTransaction::where('type', 'payment')
            ->whereBetween('date', [$lastMonthStart, $lastMonthEnd])->sum('amount');
        $expensesToday = (float) FinanceTransaction::where('type', 'payment')->whereDate('date', $today)->sum('amount');

        $receivables = (float) CustomerInvoice::whereNotIn('status', ['paid', 'cancelled'])->sum('balance');

        // Orders / invoices with outstanding balance (incomplete payment)
        $incompletePaymentCount = CustomerInvoice::whereNotIn('status', ['paid', 'cancelled'])
            ->where('balance', '>', 0)->count();

        // 12-month trend — two grouped queries (revenue + expenses) instead of 24
        // per-month SUM round-trips. Buckets for empty months are filled with 0 below.
        $trendStart = $now->copy()->subMonths(11)->startOfMonth();
        $monthlyTotals = FinanceTransaction::query()
            ->whereIn('type', ['revenue', 'payment'])
            ->where('date', '>=', $trendStart)
            ->selectRaw("type, DATE_FORMAT(date, '%Y-%m') as ym, SUM(amount) as total")
            ->groupBy('type', 'ym')
            ->get();

        $revenueByMonth = [];
        $expenseByMonth = [];
        foreach ($monthlyTotals as $row) {
            if ($row->type === 'revenue') {
                $revenueByMonth[$row->ym] = (float) $row->total;
            } else {
                $expenseByMonth[$row->ym] = (float) $row->total;
            }
        }

        $trend = [];
        for ($i = 11; $i >= 0; $i--) {
            $ym = $now->copy()->subMonths($i)->format('Y-m');
            $trend[] = [
                'month' => $ym,
                'revenue' => $revenueByMonth[$ym] ?? 0.0,
                'expenses' => $expenseByMonth[$ym] ?? 0.0,
            ];
        }

        // Expense breakdown by category
        $byCategory = Expense::query()
            ->where('status', '!=', 'rejected')
            ->whereBetween('date', [$monthStart, $now])
            ->selectRaw('category_id, SUM(amount) as total')
            ->groupBy('category_id')
            ->with('category:id,name_ar,name_en')
            ->get()
            ->map(fn ($r) => [
                'categoryId' => (string) $r->category_id,
                'nameAr' => $r->category?->name_ar,
                'nameEn' => $r->category?->name_en,
                'total' => (float) $r->total,
            ]);

        // Recent transactions
        $recent = FinanceTransaction::orderByDesc('date')->orderByDesc('id')->limit(10)->get()
            ->map(fn ($t) => $t->toApiArray());

        // Alerts
        $overdueInvoices = CustomerInvoice::where('status', '!=', 'paid')
            ->where('status', '!=', 'cancelled')
            ->whereNotNull('due_date')
            ->where('due_date', '<', $now->toDateString())
            ->count();
        $pendingAdvances = \App\Models\EmployeeDebitRequest::where('status', 'pending')->count();
        $debtsOver30 = (float) CustomerInvoice::where('status', '!=', 'paid')
            ->where('status', '!=', 'cancelled')
            ->whereNotNull('due_date')
            ->where('due_date', '<', $now->copy()->subDays(30)->toDateString())
            ->sum('balance');

        return [
            'kpi' => [
                'revenue' => ['value' => $revenueMonth, 'prev' => $revenueLastMonth],
                'revenueToday' => ['value' => $revenueToday, 'prev' => 0],
                'expenses' => ['value' => $expensesMonth, 'prev' => $expensesLastMonth],
                'expensesToday' => ['value' => $expensesToday, 'prev' => 0],
                'net' => ['value' => $revenueMonth - $expensesMonth, 'prev' => $revenueLastMonth - $expensesLastMonth],
                'netToday' => ['value' => $revenueToday - $expensesToday, 'prev' => 0],
                'receivables' => ['value' => $receivables, 'prev' => $receivables],
                'incompletePaymentCount' => $incompletePaymentCount,
            ],
            'trend' => $trend,
            'byCategory' => $byCategory->all(),
            'recent' => $recent->all(),
            'alerts' => [
                'overdueInvoices' => $overdueInvoices,
                'pendingAdvances' => $pendingAdvances,
                'debtsOver30' => $debtsOver30,
            ],
        ];
    }

    // ===== Suppliers =====

    public function listSuppliers(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        return response()->json(Supplier::orderBy('name')->get()->map->toApiArray());
    }

    public function storeSupplier(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:40',
            'email' => 'nullable|email|max:255',
            'address' => 'nullable|string|max:255',
            'vat_no' => 'nullable|string|max:40',
            'notes' => 'nullable|string',
        ]);
        $s = Supplier::create($data);
        return response()->json($s->toApiArray(), 201);
    }

    public function updateSupplier(Request $request, $id)
    {
        if ($r = $this->gate($request)) return $r;
        $s = Supplier::findOrFail($id);
        $s->update($request->only(['name', 'phone', 'email', 'address', 'vat_no', 'notes', 'archived']));
        return response()->json($s->toApiArray());
    }

    public function deleteSupplier(Request $request, $id)
    {
        if ($r = $this->gate($request)) return $r;
        Supplier::findOrFail($id)->delete();
        return response()->json(['message' => 'deleted']);
    }

    // ===== Revenue / Payments (finance_transactions) =====

    public function listTransactions(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $q = FinanceTransaction::query()->orderByDesc('date')->orderByDesc('id');
        if ($t = $request->query('type')) $q->where('type', $t);
        if ($from = $request->query('from')) $q->where('date', '>=', $from);
        if ($to = $request->query('to')) $q->where('date', '<=', $to);
        if ($source = $request->query('source')) $q->where('source', $source);
        return response()->json($q->limit(500)->get()->map->toApiArray());
    }

    public function storeTransaction(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $data = $request->validate([
            'type' => 'required|in:revenue,payment',
            'source' => 'required|string|max:40',
            'party_type' => 'nullable|string|max:16',
            'party_id' => 'nullable|integer',
            'party_name' => 'nullable|string|max:255',
            'amount' => 'required|numeric|min:0',
            'method' => 'nullable|string|max:30',
            'reference_no' => 'nullable|string|max:80',
            'date' => 'required|date',
            'notes' => 'nullable|string',
        ]);
        $data['created_by'] = $request->user()->id;
        $data['status'] = 'completed';
        $tx = FinanceTransaction::create($data);
        return response()->json($tx->toApiArray(), 201);
    }

    public function updateTransaction(Request $request, $id)
    {
        if ($r = $this->gate($request)) return $r;
        $tx = FinanceTransaction::findOrFail($id);
        if ($tx->ref_type) {
            return response()->json(['message' => 'Cannot edit a transaction generated from a voucher'], 422);
        }
        $tx->update($request->only(['source', 'party_type', 'party_id', 'party_name', 'amount', 'method', 'reference_no', 'date', 'notes', 'status']));
        return response()->json($tx->toApiArray());
    }

    public function deleteTransaction(Request $request, $id)
    {
        if ($r = $this->gate($request)) return $r;
        $tx = FinanceTransaction::findOrFail($id);
        if ($tx->ref_type) {
            return response()->json(['message' => 'Cannot delete a transaction generated from a voucher'], 422);
        }
        $tx->delete();
        return response()->json(['message' => 'deleted']);
    }

    // ===== Expense categories =====

    public function listExpenseCategories(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        ExpenseCategory::ensureDefaults();
        // Hide archived categories from the picker — they remain in the table
        // so historical expense rows can still resolve their category name.
        $q = ExpenseCategory::query()->where('archived', false);
        if ($request->boolean('include_archived')) {
            $q = ExpenseCategory::query();
        }
        return response()->json($q->orderBy('ordering')->get()->map->toApiArray());
    }

    public function storeExpenseCategory(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $data = $request->validate([
            'name_ar' => 'required|string|max:255',
            'name_en' => 'required|string|max:255',
            'ordering' => 'nullable|integer',
        ]);
        $c = ExpenseCategory::create($data);
        return response()->json($c->toApiArray(), 201);
    }

    public function updateExpenseCategory(Request $request, $id)
    {
        if ($r = $this->gate($request)) return $r;
        $c = ExpenseCategory::findOrFail($id);
        $c->update($request->only(['name_ar', 'name_en', 'ordering', 'archived']));
        return response()->json($c->toApiArray());
    }

    public function deleteExpenseCategory(Request $request, $id)
    {
        if ($r = $this->gate($request)) return $r;
        ExpenseCategory::findOrFail($id)->delete();
        return response()->json(['message' => 'deleted']);
    }

    // ===== Expenses =====

    public function listExpenses(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $q = Expense::query()->with('category', 'submittedBy:id,name', 'approvedBy:id,name')
            ->orderByDesc('date')->orderByDesc('id');
        if ($status = $request->query('status')) $q->where('status', $status);
        if ($cat = $request->query('category_id')) $q->where('category_id', $cat);
        if ($from = $request->query('from')) $q->where('date', '>=', $from);
        if ($to = $request->query('to')) $q->where('date', '<=', $to);
        return response()->json($q->limit(500)->get()->map->toApiArray());
    }

    public function storeExpense(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $data = $request->validate([
            'category_id' => 'required|exists:expense_categories,id',
            'description' => 'required|string',
            'amount' => 'required|numeric|min:0',
            'date' => 'required|date',
            'supplier_name' => 'nullable|string|max:255',
            'supplier_id' => 'nullable|exists:suppliers,id',
            'payment_method' => 'nullable|string|max:30',
            'reference_no' => 'nullable|string|max:80',
            'attachment_path' => 'nullable|string',
        ]);
        $data['submitted_by'] = $request->user()->id;
        $data['status'] = 'pending';
        $e = Expense::create($data);
        return response()->json($e->toApiArray(), 201);
    }

    public function decideExpense(Request $request, $id)
    {
        if ($r = $this->gate($request)) return $r;
        $data = $request->validate([
            'status' => 'required|in:approved,rejected,paid',
            'rejection_reason' => 'nullable|string',
        ]);
        $e = Expense::findOrFail($id);
        $e->status = $data['status'];
        $e->approved_by = $request->user()->id;
        $e->approved_at = now();
        if ($data['status'] === 'rejected') {
            $e->rejection_reason = $data['rejection_reason'] ?? null;
        }
        $e->save();

        // Emit a payment finance_transaction when marked paid
        if ($data['status'] === 'paid') {
            FinanceTransaction::updateOrCreate(
                ['ref_type' => 'expense', 'ref_id' => $e->id, 'type' => 'payment'],
                [
                    'source' => 'expense',
                    'party_name' => $e->supplier_name,
                    'amount' => $e->amount,
                    'method' => $e->payment_method,
                    'reference_no' => $e->reference_no,
                    'date' => $e->date,
                    'notes' => $e->description,
                    'status' => 'completed',
                    'created_by' => $request->user()->id,
                ]
            );
        }

        return response()->json($e->toApiArray());
    }

    public function deleteExpense(Request $request, $id)
    {
        if ($r = $this->gate($request)) return $r;
        $e = Expense::findOrFail($id);
        FinanceTransaction::where('ref_type', 'expense')->where('ref_id', $e->id)->delete();
        $e->delete();
        return response()->json(['message' => 'deleted']);
    }

    // ===== Customer invoices =====

    public function listCustomerInvoices(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $q = CustomerInvoice::with('client:id,name', 'items')->orderByDesc('date')->orderByDesc('id');
        if ($status = $request->query('status')) $q->where('status', $status);
        if ($client = $request->query('client_id')) $q->where('client_id', $client);
        return response()->json($q->limit(500)->get()->map->toApiArray());
    }

    public function showCustomerInvoice(Request $request, $id)
    {
        if ($r = $this->gate($request)) return $r;
        $inv = CustomerInvoice::with('client', 'items')->findOrFail($id);
        return response()->json($inv->toApiArray());
    }

    public function storeCustomerInvoice(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $data = $request->validate([
            'date' => 'required|date',
            'due_date' => 'nullable|date',
            'client_id' => 'nullable|exists:clients,id',
            'client_name_snapshot' => 'nullable|string|max:255',
            'order_id' => 'nullable|exists:orders,id',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string',
            'items.*.quantity' => 'required|numeric|min:0',
            'items.*.unit_price' => 'required|numeric|min:0',
        ]);

        $settings = WorkScheduleSetting::current();
        $vatRate = (float) $settings->vat_rate;

        return DB::transaction(function () use ($data, $vatRate, $request) {
            $subtotal = 0;
            foreach ($data['items'] as $it) {
                $subtotal += ((float) $it['quantity']) * ((float) $it['unit_price']);
            }
            $vat = round($subtotal * $vatRate / 100, 2);
            $total = $subtotal + $vat;
            $number = $this->nextInvoiceNumber('INV');

            $inv = CustomerInvoice::create([
                'number' => $number,
                'date' => $data['date'],
                'due_date' => $data['due_date'] ?? null,
                'client_id' => $data['client_id'] ?? null,
                'client_name_snapshot' => $data['client_name_snapshot'] ?? null,
                'order_id' => $data['order_id'] ?? null,
                'subtotal' => $subtotal,
                'vat_rate' => $vatRate,
                'vat_amount' => $vat,
                'total' => $total,
                'paid' => 0,
                'balance' => $total,
                'status' => 'sent',
                'notes' => $data['notes'] ?? null,
                'created_by' => $request->user()->id,
            ]);

            foreach ($data['items'] as $i => $it) {
                CustomerInvoiceItem::create([
                    'invoice_id' => $inv->id,
                    'description' => $it['description'],
                    'quantity' => $it['quantity'],
                    'unit_price' => $it['unit_price'],
                    'line_total' => ((float) $it['quantity']) * ((float) $it['unit_price']),
                    'ordering' => $i,
                ]);
            }
            return response()->json($inv->fresh(['client', 'items'])->toApiArray(), 201);
        });
    }

    public function updateCustomerInvoice(Request $request, $id)
    {
        if ($r = $this->gate($request)) return $r;
        $inv = CustomerInvoice::findOrFail($id);
        $inv->update($request->only(['date', 'due_date', 'notes', 'status']));
        return response()->json($inv->fresh(['client', 'items'])->toApiArray());
    }

    public function deleteCustomerInvoice(Request $request, $id)
    {
        if ($r = $this->gate($request)) return $r;
        $inv = CustomerInvoice::findOrFail($id);
        if ($inv->paid > 0) {
            return response()->json(['message' => 'Cannot delete invoice with payments'], 422);
        }
        $inv->delete();
        return response()->json(['message' => 'deleted']);
    }

    // ===== Supplier invoices =====

    public function listSupplierInvoices(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $q = SupplierInvoice::with('supplier:id,name', 'items')->orderByDesc('date')->orderByDesc('id');
        if ($status = $request->query('status')) $q->where('status', $status);
        if ($sup = $request->query('supplier_id')) $q->where('supplier_id', $sup);
        return response()->json($q->limit(500)->get()->map->toApiArray());
    }

    public function storeSupplierInvoice(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $data = $request->validate([
            'number' => 'required|string|max:40',
            'date' => 'required|date',
            'due_date' => 'nullable|date',
            'supplier_id' => 'required|exists:suppliers,id',
            'notes' => 'nullable|string',
            'attachment_path' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string',
            'items.*.quantity' => 'required|numeric|min:0',
            'items.*.unit_price' => 'required|numeric|min:0',
        ]);

        // Enforce the (supplier_id, number) unique index with a clean 422 instead of a 500.
        if (SupplierInvoice::where('supplier_id', $data['supplier_id'])->where('number', $data['number'])->exists()) {
            return response()->json([
                'message' => 'A supplier invoice with this number already exists for this supplier.',
                'errors' => ['number' => ['Duplicate invoice number for this supplier.']],
            ], 422);
        }

        $vatRate = (float) WorkScheduleSetting::current()->vat_rate;

        return DB::transaction(function () use ($data, $vatRate, $request) {
            $subtotal = 0;
            foreach ($data['items'] as $it) {
                $subtotal += ((float) $it['quantity']) * ((float) $it['unit_price']);
            }
            $vat = round($subtotal * $vatRate / 100, 2);
            $total = $subtotal + $vat;

            $inv = SupplierInvoice::create([
                'number' => $data['number'],
                'date' => $data['date'],
                'due_date' => $data['due_date'] ?? null,
                'supplier_id' => $data['supplier_id'],
                'subtotal' => $subtotal,
                'vat_rate' => $vatRate,
                'vat_amount' => $vat,
                'total' => $total,
                'paid' => 0,
                'balance' => $total,
                'status' => 'pending_approval',
                'notes' => $data['notes'] ?? null,
                'attachment_path' => $data['attachment_path'] ?? null,
                'created_by' => $request->user()->id,
            ]);

            foreach ($data['items'] as $i => $it) {
                SupplierInvoiceItem::create([
                    'invoice_id' => $inv->id,
                    'description' => $it['description'],
                    'quantity' => $it['quantity'],
                    'unit_price' => $it['unit_price'],
                    'line_total' => ((float) $it['quantity']) * ((float) $it['unit_price']),
                    'ordering' => $i,
                ]);
            }
            return response()->json($inv->fresh(['supplier', 'items'])->toApiArray(), 201);
        });
    }

    public function decideSupplierInvoice(Request $request, $id)
    {
        if ($r = $this->gate($request)) return $r;
        $data = $request->validate([
            'status' => 'required|in:approved,rejected',
            'rejection_reason' => 'nullable|string',
        ]);
        $inv = SupplierInvoice::findOrFail($id);
        $inv->status = $data['status'];
        $inv->approved_by = $request->user()->id;
        $inv->approved_at = now();
        if ($data['status'] === 'rejected') {
            $inv->rejection_reason = $data['rejection_reason'] ?? null;
        }
        $inv->save();
        return response()->json($inv->fresh(['supplier', 'items'])->toApiArray());
    }

    public function deleteSupplierInvoice(Request $request, $id)
    {
        if ($r = $this->gate($request)) return $r;
        $inv = SupplierInvoice::findOrFail($id);
        if ($inv->paid > 0) {
            return response()->json(['message' => 'Cannot delete invoice with payments'], 422);
        }
        $inv->delete();
        return response()->json(['message' => 'deleted']);
    }

    // ===== Receipt vouchers =====

    public function listReceiptVouchers(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $q = ReceiptVoucher::with('client:id,name', 'allocations')->orderByDesc('date')->orderByDesc('id');
        if ($client = $request->query('client_id')) $q->where('client_id', $client);
        return response()->json($q->limit(500)->get()->map->toApiArray());
    }

    public function storeReceiptVoucher(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $data = $request->validate([
            'date' => 'required|date',
            'client_id' => 'nullable|exists:clients,id',
            'payer_name' => 'nullable|string|max:255',
            'amount' => 'required|numeric|min:0',
            'method' => 'nullable|string|max:30',
            'reference_no' => 'nullable|string|max:80',
            'notes' => 'nullable|string',
            'allocations' => 'array',
            'allocations.*.invoice_id' => 'required|exists:customer_invoices,id',
            'allocations.*.amount' => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($data, $request) {
            $number = $this->nextInvoiceNumber('RV');
            $v = ReceiptVoucher::create([
                'number' => $number,
                'date' => $data['date'],
                'client_id' => $data['client_id'] ?? null,
                'payer_name' => $data['payer_name'] ?? null,
                'amount' => $data['amount'],
                'method' => $data['method'] ?? null,
                'reference_no' => $data['reference_no'] ?? null,
                'notes' => $data['notes'] ?? null,
                'created_by' => $request->user()->id,
            ]);

            foreach ($data['allocations'] ?? [] as $alloc) {
                ReceiptVoucherAllocation::create([
                    'voucher_id' => $v->id,
                    'invoice_id' => $alloc['invoice_id'],
                    'amount' => $alloc['amount'],
                ]);
                $inv = CustomerInvoice::find($alloc['invoice_id']);
                if ($inv) {
                    $inv->paid = (float) $inv->paid + (float) $alloc['amount'];
                    $inv->balance = max(0, (float) $inv->total - (float) $inv->paid);
                    $inv->status = $inv->balance <= 0.01 ? 'paid' : 'partial';
                    $inv->save();
                }
            }

            // Emit a revenue finance_transaction
            FinanceTransaction::updateOrCreate(
                ['ref_type' => 'receipt_voucher', 'ref_id' => $v->id, 'type' => 'revenue'],
                [
                    'source' => 'receipt',
                    'party_type' => 'client',
                    'party_id' => $v->client_id,
                    'party_name' => $v->client?->name ?? $v->payer_name,
                    'amount' => $v->amount,
                    'method' => $v->method,
                    'reference_no' => $v->number,
                    'date' => $v->date,
                    'notes' => $v->notes,
                    'status' => 'completed',
                    'created_by' => $request->user()->id,
                ]
            );

            return response()->json($v->fresh(['client', 'allocations'])->toApiArray(), 201);
        });
    }

    /**
     * List every OrderPayment as a printable receipt. Returned shape is
     * close to ReceiptVoucher::toApiArray() so the Invoices panel can
     * render it with the same DataTable. Refunds (negative-amount rows)
     * are excluded — they're shown in the Payments tab instead.
     */
    public function listOrderPaymentReceipts(Request $request)
    {
        if ($r = $this->gate($request)) return $r;

        $rows = OrderPayment::with(['order:id,client_id,receipt_number,customer_reference', 'order.client:id,name', 'order.task:id,order_id,customer_name', 'recorder:id,name'])
            ->where('amount', '>', 0)
            ->orderByDesc('paid_at')
            ->orderByDesc('id')
            ->limit(500)
            ->get();

        $out = $rows->map(function (OrderPayment $p) {
            $order = $p->order;
            $client = $order?->client?->name
                ?? $order?->task?->customer_name
                ?? $order?->customer_reference
                ?? null;
            return [
                'id' => (string) $p->id,
                'number' => 'PAY-'.str_pad((string) $p->id, 4, '0', STR_PAD_LEFT),
                'date' => optional($p->paid_at)->toDateString(),
                'orderId' => $order ? (string) $order->id : null,
                'orderRef' => $order?->receipt_number ? $order->receipt_number : ($order ? 'ORD-'.$order->id : null),
                'clientName' => $client,
                'amount' => round((float) $p->amount, 2),
                'method' => $p->method,
                'referenceNo' => $p->method === 'check' ? $p->cheque_number : null,
                'note' => $p->note,
                'recordedByName' => $p->recorder?->name,
                'cheque' => $p->method === 'check' && $p->cheque_number ? [
                    'bank' => $p->cheque_bank,
                    'number' => $p->cheque_number,
                    'holder' => $p->cheque_holder,
                    'amount' => $p->cheque_amount !== null ? round((float) $p->cheque_amount, 2) : null,
                    'issueDate' => $p->cheque_issue_date?->toDateString(),
                    'dueDate' => $p->cheque_due_date?->toDateString(),
                    'status' => $p->cheque_status,
                ] : null,
            ];
        });

        return response()->json($out->values());
    }

    // ===== Payment vouchers =====

    public function listPaymentVouchers(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $q = PaymentVoucher::with('allocations')->orderByDesc('date')->orderByDesc('id');
        if ($type = $request->query('payee_type')) $q->where('payee_type', $type);
        return response()->json($q->limit(500)->get()->map->toApiArray());
    }

    public function storePaymentVoucher(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $data = $request->validate([
            'date' => 'required|date',
            'payee_type' => 'required|in:supplier,employee,other',
            'payee_id' => 'nullable|integer',
            'payee_name' => 'nullable|string|max:255',
            'amount' => 'required|numeric|min:0',
            'method' => 'nullable|string|max:30',
            'reference_no' => 'nullable|string|max:80',
            'purpose' => 'nullable|string',
            'notes' => 'nullable|string',
            'allocations' => 'array',
            'allocations.*.invoice_id' => 'required|exists:supplier_invoices,id',
            'allocations.*.amount' => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($data, $request) {
            $number = $this->nextInvoiceNumber('PV');
            $v = PaymentVoucher::create([
                'number' => $number,
                'date' => $data['date'],
                'payee_type' => $data['payee_type'],
                'payee_id' => $data['payee_id'] ?? null,
                'payee_name' => $data['payee_name'] ?? null,
                'amount' => $data['amount'],
                'method' => $data['method'] ?? null,
                'reference_no' => $data['reference_no'] ?? null,
                'purpose' => $data['purpose'] ?? null,
                'notes' => $data['notes'] ?? null,
                'created_by' => $request->user()->id,
            ]);

            foreach ($data['allocations'] ?? [] as $alloc) {
                PaymentVoucherAllocation::create([
                    'voucher_id' => $v->id,
                    'invoice_id' => $alloc['invoice_id'],
                    'amount' => $alloc['amount'],
                ]);
                $inv = SupplierInvoice::find($alloc['invoice_id']);
                if ($inv) {
                    $inv->paid = (float) $inv->paid + (float) $alloc['amount'];
                    $inv->balance = max(0, (float) $inv->total - (float) $inv->paid);
                    if ($inv->balance <= 0.01) $inv->status = 'paid';
                    $inv->save();
                }
            }

            FinanceTransaction::updateOrCreate(
                ['ref_type' => 'payment_voucher', 'ref_id' => $v->id, 'type' => 'payment'],
                [
                    'source' => 'voucher',
                    'party_type' => $v->payee_type,
                    'party_id' => $v->payee_id,
                    'party_name' => $v->payeeDisplayName(),
                    'amount' => $v->amount,
                    'method' => $v->method,
                    'reference_no' => $v->number,
                    'date' => $v->date,
                    'notes' => $v->purpose,
                    'status' => 'completed',
                    'created_by' => $request->user()->id,
                ]
            );

            return response()->json($v->fresh('allocations')->toApiArray(), 201);
        });
    }

    // ===== Advances (read-only view of employee salary-advance requests) =====

    public function advances(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $q = EmployeeDebitRequest::query()
            ->with('user:id,name,email', 'decidedBy:id,name')
            ->orderByDesc('created_at');
        if ($request->filled('status')) {
            $q->where('status', (string) $request->query('status'));
        }
        return response()->json($q->get()->map(fn ($row) => $row->toApiArray())->values());
    }

    // ===== Debts / Aging =====

    public function aging(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $today = Carbon::today();

        $bucketize = function ($invoices) use ($today) {
            $b = ['current_0_30' => 0, 'd31_60' => 0, 'd61_90' => 0, 'd90_plus' => 0];
            $rows = [];
            foreach ($invoices as $inv) {
                $due = $inv->due_date ? Carbon::parse($inv->due_date) : Carbon::parse($inv->date);
                $age = $today->diffInDays($due, false);
                $key = $age >= 0 ? 'current_0_30' : (
                    abs($age) <= 30 ? 'current_0_30' : (
                        abs($age) <= 60 ? 'd31_60' : (
                            abs($age) <= 90 ? 'd61_90' : 'd90_plus'
                        )
                    )
                );
                $b[$key] += (float) $inv->balance;
                $rows[] = $inv;
            }
            return ['buckets' => $b, 'rows' => $rows];
        };

        $customerOpen = CustomerInvoice::whereNotIn('status', ['paid', 'cancelled'])
            ->with('client:id,name')->get();
        $supplierOpen = SupplierInvoice::whereNotIn('status', ['paid', 'rejected'])
            ->with('supplier:id,name')->get();

        $cust = $bucketize($customerOpen);
        $sup = $bucketize($supplierOpen);

        return response()->json([
            'receivables' => [
                'buckets' => $cust['buckets'],
                'rows' => collect($cust['rows'])->map->toApiArray(),
            ],
            'payables' => [
                'buckets' => $sup['buckets'],
                'rows' => collect($sup['rows'])->map->toApiArray(),
            ],
        ]);
    }

    // ===== Reports =====

    public function reportPnl(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $from = $request->query('from') ?: Carbon::now()->startOfYear()->toDateString();
        $to = $request->query('to') ?: Carbon::now()->toDateString();

        $revenue = (float) FinanceTransaction::where('type', 'revenue')->whereBetween('date', [$from, $to])->sum('amount');
        $expenses = (float) FinanceTransaction::where('type', 'payment')->whereBetween('date', [$from, $to])->sum('amount');

        // Monthly breakdown — driver-agnostic month bucketing (works on MySQL, PostgreSQL, SQLite)
        $byMonth = FinanceTransaction::whereBetween('date', [$from, $to])
            ->get(['date', 'type', 'amount'])
            ->groupBy(fn ($t) => $t->date->format('Y-m') . '|' . $t->type)
            ->map(function ($group) {
                $first = $group->first();
                return [
                    'month' => $first->date->format('Y-m'),
                    'type' => $first->type,
                    'total' => (float) $group->sum('amount'),
                ];
            })
            ->values();

        return response()->json([
            'from' => $from,
            'to' => $to,
            'totals' => ['revenue' => $revenue, 'expenses' => $expenses, 'net' => $revenue - $expenses],
            'byMonth' => $byMonth,
        ]);
    }

    public function reportExpenseBreakdown(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $from = $request->query('from') ?: Carbon::now()->startOfYear()->toDateString();
        $to = $request->query('to') ?: Carbon::now()->toDateString();

        $rows = Expense::where('status', '!=', 'rejected')
            ->whereBetween('date', [$from, $to])
            ->selectRaw('category_id, SUM(amount) as total, COUNT(*) as cnt')
            ->groupBy('category_id')
            ->with('category:id,name_ar,name_en')
            ->get()
            ->map(fn ($r) => [
                'categoryId' => (string) $r->category_id,
                'nameAr' => $r->category?->name_ar,
                'nameEn' => $r->category?->name_en,
                'total' => (float) $r->total,
                'count' => (int) $r->cnt,
            ]);

        return response()->json(['from' => $from, 'to' => $to, 'rows' => $rows]);
    }

    public function workScheduleSettings(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        return response()->json(WorkScheduleSetting::current()->toApiArray());
    }

    public function updateWorkScheduleSettings(Request $request)
    {
        if ($r = $this->gate($request)) return $r;
        $s = WorkScheduleSetting::current();
        $s->update($request->only([
            'work_start', 'work_end', 'grace_minutes', 'work_days',
            'late_deduction_per_minute', 'absence_deduction_formula',
            'vat_rate', 'employee_insurance_pct', 'employer_insurance_pct',
        ]));
        return response()->json($s->fresh()->toApiArray());
    }

    // ===== Helpers =====

    private function nextInvoiceNumber(string $prefix): string
    {
        $year = date('Y');
        $key = "$prefix-$year-";
        $last = match ($prefix) {
            'INV' => CustomerInvoice::where('number', 'like', "$key%")->orderByDesc('id')->value('number'),
            'RV' => ReceiptVoucher::where('number', 'like', "$key%")->orderByDesc('id')->value('number'),
            'PV' => PaymentVoucher::where('number', 'like', "$key%")->orderByDesc('id')->value('number'),
            default => null,
        };
        $next = 1;
        if ($last && preg_match('/(\d+)$/', $last, $m)) {
            $next = (int) $m[1] + 1;
        }
        return sprintf('%s%05d', $key, $next);
    }
}
