<?php

namespace App\Http\Controllers;

use App\Models\AdminSubmission;
use App\Models\Client;
use App\Models\Color;
use App\Models\EmployeeDebitRequest;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderPayment;
use App\Models\ProductCategory;
use App\Models\Profile;
use App\Models\User;
use App\Services\InAppNotifier;
use App\Support\ReceiptPaymentAnalytics;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class AccountantFinanceController extends Controller
{
    public function overview(Request $request)
    {
        $user = $request->user();
        if (! $this->canAccessAccountantFinance($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $orders = $this->accountantOrders();
        $aggregate = ReceiptPaymentAnalytics::aggregate($orders, now());

        return response()->json([
            'generatedAt' => $aggregate['generatedAt'],
            'totals' => $aggregate['allTime'],
            'byPaymentStatus' => $aggregate['byPaymentStatus'],
            'overdueCount' => $aggregate['overdueCount'],
            'overdueOutstanding' => $aggregate['overdueOutstanding'],
            'clientsCount' => Client::query()->count(),
            'receiptsCount' => $aggregate['allTime']['count'],
            'topOutstandingCustomers' => $aggregate['topOutstandingCustomers'],
        ]);
    }

    public function clients(Request $request)
    {
        $user = $request->user();
        if (! $this->canAccessAccountantFinance($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $q = trim((string) $request->query('q', ''));
        $query = Client::query()->with('supervisor:id,name')->orderBy('name');
        if ($q !== '') {
            $needle = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $q).'%';
            $query->where(function ($w) use ($needle) {
                $w->where('name', 'like', $needle)
                    ->orWhere('phone', 'like', $needle)
                    ->orWhere('email', 'like', $needle);
            });
        }

        $clients = $query->get();
        $clientIds = $clients->pluck('id')->all();
        $ordersByClient = Order::query()
            ->whereIn('client_id', $clientIds)
            ->where('status', 'completed')
            ->whereNotNull('receipt_number')
            ->orderByDesc('updated_at')
            ->get()
            ->groupBy('client_id');

        $lastPayments = OrderPayment::query()
            ->with('order:id,client_id')
            ->whereHas('order', fn ($q) => $q->whereIn('client_id', $clientIds))
            ->orderByDesc('paid_at')
            ->get()
            ->groupBy(fn ($p) => $p->order?->client_id);

        return response()->json($clients->map(function (Client $client) use ($ordersByClient, $lastPayments) {
            $orders = $ordersByClient->get($client->id, collect());
            $total = (float) $orders->sum(fn (Order $o) => (float) ($o->total_amount ?? 0));
            $paid = (float) $orders->sum(fn (Order $o) => (float) ($o->amount_paid ?? 0));
            $lastPayment = $lastPayments->get($client->id)?->first();

            return [
                'id' => (string) $client->id,
                'supervisorId' => $client->supervisor_id ? (string) $client->supervisor_id : null,
                'supervisorName' => $client->supervisor?->name,
                'source' => $client->source ?? 'supervisor',
                'name' => $client->name,
                'phone' => $client->phone,
                'email' => $client->email,
                'notes' => $client->notes,
                'orderCount' => $orders->count(),
                'totalPurchases' => round($total, 2),
                'totalPaid' => round($paid, 2),
                'balanceDue' => round(max(0, $total - $paid), 2),
                'lastPaymentAt' => $lastPayment?->paid_at?->toIso8601String(),
                'createdAt' => $client->created_at->toISOString(),
                'updatedAt' => $client->updated_at->toISOString(),
            ];
        })->values());
    }

    public function storeClient(Request $request)
    {
        $user = $request->user();
        if (! $this->canAccessAccountantFinance($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:64',
            'email' => 'nullable|email|max:255',
            'notes' => 'nullable|string|max:10000',
        ]);

        $client = Client::create([
            'supervisor_id' => null,
            'accountant_created_by' => $user->id,
            'source' => 'accountant',
            'name' => $data['name'],
            'phone' => $data['phone'] ?? null,
            'email' => $data['email'] ?? null,
            'notes' => $data['notes'] ?? null,
        ]);

        return response()->json([
            'id' => (string) $client->id,
            'name' => $client->name,
            'phone' => $client->phone,
            'email' => $client->email,
            'notes' => $client->notes,
            'source' => $client->source,
        ], 201);
    }

    public function updateClient(Request $request, Client $client)
    {
        $user = $request->user();
        if (! $this->canAccessAccountantFinance($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'phone' => 'nullable|string|max:64',
            'email' => 'nullable|email|max:255',
            'notes' => 'nullable|string|max:10000',
        ]);

        foreach (['name', 'phone', 'email', 'notes'] as $field) {
            if (array_key_exists($field, $data)) {
                $client->{$field} = $data[$field];
            }
        }
        $client->save();

        return response()->json([
            'id' => (string) $client->id,
            'name' => $client->name,
            'phone' => $client->phone,
            'email' => $client->email,
            'notes' => $client->notes,
            'source' => $client->source,
        ]);
    }

    public function manualReceipt(Request $request)
    {
        $user = $request->user();
        if (! $this->canAccessAccountantFinance($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'client_id' => 'required|exists:clients,id',
            'customer_reference' => 'nullable|string|max:255',
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string|max:500',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'required|numeric|min:0',
            'amount_paid' => 'nullable|numeric|min:0',
            'payment_due_at' => 'nullable|date',
            'payment_notes' => 'nullable|string|max:2000',
        ]);

        return DB::transaction(function () use ($data, $user) {
            [$profile, $color] = $this->manualCatalogRows();
            $total = 0.0;
            foreach ($data['items'] as $line) {
                $total += round((float) $line['unit_price'] * (int) $line['quantity'], 2);
            }
            $total = round($total, 2);
            $paid = round((float) ($data['amount_paid'] ?? 0), 2);
            if ($paid > $total + 0.009) {
                return response()->json(['message' => 'Amount paid cannot exceed receipt total'], 422);
            }

            $order = Order::create([
                'creator_id' => $user->id,
                'supervisor_id' => null,
                'client_id' => $data['client_id'],
                'status' => 'completed',
                'customer_reference' => $data['customer_reference'] ?? null,
                'total_amount' => $total,
                'amount_paid' => $paid,
                'payment_due_at' => $data['payment_due_at'] ?? null,
                'payment_notes' => $data['payment_notes'] ?? null,
                'currency' => 'ILS',
                'receipt_number' => $this->nextReceiptNumber(),
            ]);

            foreach ($data['items'] as $line) {
                $qty = (int) $line['quantity'];
                $unit = round((float) $line['unit_price'], 2);
                OrderItem::create([
                    'order_id' => $order->id,
                    'profile_id' => $profile->id,
                    'color_code' => $color->color_code,
                    'quantity' => $qty,
                    'unit_price' => $unit,
                    'line_total' => round($qty * $unit, 2),
                    'notes' => $line['description'],
                ]);
            }

            if ($paid > 0.009) {
                OrderPayment::create([
                    'order_id' => $order->id,
                    'amount' => $paid,
                    'paid_at' => now(),
                    'recorded_by' => $user->id,
                    'note' => 'Initial manual receipt payment',
                ]);
            }

            $order->load(['items.profile.category', 'items.color', 'creator:id,name', 'supervisor:id,name', 'client:id,name,phone,email', 'task:id,title,order_id,customer_name,client_id']);

            return response()->json($this->orderToAccountantArray($order), 201);
        });
    }

    public function cashFlow(Request $request)
    {
        $user = $request->user();
        if (! $this->canAccessAccountantFinance($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $period = $request->query('period', 'month');
        try {
            [$from, $to] = $this->periodBounds($period);
        } catch (\InvalidArgumentException) {
            return response()->json(['message' => 'Invalid period'], 422);
        }

        $orders = $this->accountantOrders();
        $filtered = $this->filterOrdersByUpdatedRange($orders, $from, $to);
        $aggregate = ReceiptPaymentAnalytics::aggregate($filtered, $to->copy());

        return response()->json([
            'period' => $period,
            'range' => [
                'from' => $from->toIso8601String(),
                'to' => $to->toIso8601String(),
            ],
            'totals' => $aggregate['allTime'],
            'byPaymentStatus' => $aggregate['byPaymentStatus'],
            'overdueCount' => $aggregate['overdueCount'],
            'overdueOutstanding' => $aggregate['overdueOutstanding'],
            'dueNextMonth' => $aggregate['dueNextMonth'],
            'topOutstandingCustomers' => $aggregate['topOutstandingCustomers'],
            'customersWithOutstandingCount' => $aggregate['customersWithOutstandingCount'] ?? 0,
            'generatedAt' => $aggregate['generatedAt'],
        ]);
    }

    /**
     * Receivables aging — bucket outstanding balances by how long they've been overdue.
     * Buckets: not-yet-due, 0-30 days overdue, 31-60, 61-90, 90+. Each bucket lists the
     * orders behind it so the UI can show drill-downs.
     */
    public function aging(Request $request)
    {
        $user = $request->user();
        if (! $this->canAccessAccountantFinance($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $now = Carbon::now();
        $orders = $this->accountantOrders()
            ->filter(function (Order $o) {
                $total = (float) ($o->total_amount ?? 0);
                $paid = (float) ($o->amount_paid ?? 0);

                return max(0, $total - $paid) > 0.009;
            });

        $buckets = [
            'notDue' => ['label' => 'Not yet due', 'min' => null, 'max' => 0, 'count' => 0, 'outstanding' => 0.0, 'orders' => []],
            'd0_30' => ['label' => '1-30 days', 'min' => 1, 'max' => 30, 'count' => 0, 'outstanding' => 0.0, 'orders' => []],
            'd31_60' => ['label' => '31-60 days', 'min' => 31, 'max' => 60, 'count' => 0, 'outstanding' => 0.0, 'orders' => []],
            'd61_90' => ['label' => '61-90 days', 'min' => 61, 'max' => 90, 'count' => 0, 'outstanding' => 0.0, 'orders' => []],
            'd90_plus' => ['label' => '90+ days', 'min' => 91, 'max' => null, 'count' => 0, 'outstanding' => 0.0, 'orders' => []],
        ];

        foreach ($orders as $o) {
            $balance = round(max(0, (float) $o->total_amount - (float) ($o->amount_paid ?? 0)), 2);
            $due = $o->payment_due_at;
            $daysOverdue = 0;
            $bucketKey = 'notDue';
            if ($due) {
                $daysOverdue = $due->copy()->endOfDay()->diffInDays($now, false);
                if ($daysOverdue <= 0) {
                    $bucketKey = 'notDue';
                    $daysOverdue = 0;
                } elseif ($daysOverdue <= 30) {
                    $bucketKey = 'd0_30';
                } elseif ($daysOverdue <= 60) {
                    $bucketKey = 'd31_60';
                } elseif ($daysOverdue <= 90) {
                    $bucketKey = 'd61_90';
                } else {
                    $bucketKey = 'd90_plus';
                }
            }

            $buckets[$bucketKey]['count']++;
            $buckets[$bucketKey]['outstanding'] = round($buckets[$bucketKey]['outstanding'] + $balance, 2);
            $buckets[$bucketKey]['orders'][] = [
                'id' => (string) $o->id,
                'receiptNumber' => $o->receipt_number,
                'clientId' => $o->client_id ? (string) $o->client_id : null,
                'clientName' => $o->client?->name ?? $o->task?->customer_name ?? $o->customer_reference,
                'totalAmount' => (float) ($o->total_amount ?? 0),
                'amountPaid' => (float) ($o->amount_paid ?? 0),
                'balanceDue' => $balance,
                'paymentDueAt' => $due?->toDateString(),
                'daysOverdue' => (int) $daysOverdue,
                'paymentStatus' => Order::derivePaymentStatus((float) $o->total_amount, (float) ($o->amount_paid ?? 0)),
                'updatedAt' => $o->updated_at->toISOString(),
            ];
        }

        foreach ($buckets as $key => $b) {
            usort($buckets[$key]['orders'], fn ($a, $b2) => ($b2['daysOverdue'] <=> $a['daysOverdue']) ?: ($b2['balanceDue'] <=> $a['balanceDue']));
        }

        $totalOutstanding = array_sum(array_column($buckets, 'outstanding'));
        $totalCount = array_sum(array_column($buckets, 'count'));

        return response()->json([
            'generatedAt' => $now->toIso8601String(),
            'buckets' => array_values(array_map(fn ($k, $b) => array_merge(['key' => $k], $b), array_keys($buckets), $buckets)),
            'totals' => [
                'count' => $totalCount,
                'outstanding' => round($totalOutstanding, 2),
            ],
        ]);
    }

    /**
     * Trend series — last N months of revenue (billed) and collections (paid). Used by
     * the dashboard chart so the accountant can see momentum at a glance.
     */
    public function trend(Request $request)
    {
        $user = $request->user();
        if (! $this->canAccessAccountantFinance($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $months = (int) $request->query('months', 6);
        if ($months < 1) {
            $months = 1;
        }
        if ($months > 24) {
            $months = 24;
        }

        $now = Carbon::now();
        $start = $now->copy()->subMonthsNoOverflow($months - 1)->startOfMonth();

        $orders = $this->accountantOrders()
            ->filter(fn (Order $o) => $o->created_at->gte($start));

        $payments = OrderPayment::query()
            ->whereHas('order', fn ($q) => $q->where('status', 'completed')->whereNotNull('receipt_number'))
            ->where('paid_at', '>=', $start)
            ->get(['order_id', 'amount', 'paid_at']);

        $series = [];
        for ($i = 0; $i < $months; $i++) {
            $bucketStart = $start->copy()->addMonthsNoOverflow($i);
            $bucketEnd = $bucketStart->copy()->endOfMonth();
            $bucketLabel = $bucketStart->format('Y-m');

            $billed = $orders
                ->filter(fn (Order $o) => $o->created_at->gte($bucketStart) && $o->created_at->lte($bucketEnd))
                ->sum(fn (Order $o) => (float) ($o->total_amount ?? 0));

            $collected = $payments
                ->filter(fn ($p) => $p->paid_at && $p->paid_at->gte($bucketStart) && $p->paid_at->lte($bucketEnd))
                ->sum(fn ($p) => (float) $p->amount);

            $series[] = [
                'month' => $bucketLabel,
                'billed' => round((float) $billed, 2),
                'collected' => round((float) $collected, 2),
            ];
        }

        return response()->json([
            'generatedAt' => $now->toIso8601String(),
            'months' => $months,
            'series' => $series,
        ]);
    }

    /**
     * Employee debits summary — outstanding loans/advances given to employees so the
     * accountant can see the cash-out side of the books. Approved debits = money out.
     */
    public function debits(Request $request)
    {
        $user = $request->user();
        if (! $this->canAccessAccountantFinance($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $rows = EmployeeDebitRequest::query()
            ->with('user:id,name,email', 'decidedBy:id,name')
            ->orderByDesc('created_at')
            ->get();

        $totals = [
            'pending' => ['count' => 0, 'amount' => 0.0],
            'approved' => ['count' => 0, 'amount' => 0.0],
            'rejected' => ['count' => 0, 'amount' => 0.0],
            'cancelled' => ['count' => 0, 'amount' => 0.0],
        ];
        foreach ($rows as $r) {
            $key = $r->status;
            if (! isset($totals[$key])) {
                continue;
            }
            $totals[$key]['count']++;
            $totals[$key]['amount'] = round($totals[$key]['amount'] + (float) $r->amount, 2);
        }

        return response()->json([
            'generatedAt' => Carbon::now()->toIso8601String(),
            'totals' => $totals,
            'rows' => $rows->map(fn ($r) => $r->toApiArray())->values(),
        ]);
    }

    public function receiptReportPdf(Request $request)
    {
        $user = $request->user();
        if (! $this->canAccessAccountantFinance($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $period = $request->query('period', 'month');
        try {
            [$from, $to] = $this->periodBounds($period);
        } catch (\InvalidArgumentException) {
            return response()->json(['message' => 'Invalid period'], 422);
        }

        $orders = $this->accountantOrders();
        $filtered = $this->filterOrdersByUpdatedRange($orders, $from, $to);
        $aggregate = ReceiptPaymentAnalytics::aggregate($filtered, $to->copy());

        $pdf = Pdf::loadView('pdf.receipt-period', [
            'period' => $period,
            'from' => $from,
            'to' => $to,
            'totals' => $aggregate['allTime'],
            'byPaymentStatus' => $aggregate['byPaymentStatus'],
            'overdueCount' => $aggregate['overdueCount'],
            'overdueOutstanding' => $aggregate['overdueOutstanding'],
            'topOutstandingCustomers' => $aggregate['topOutstandingCustomers'],
        ]);

        $filename = 'receipt-report-'.$period.'-'.$from->format('Y-m-d').'.pdf';

        return $pdf->download($filename);
    }

    public function publishReport(Request $request)
    {
        $user = $request->user();
        if (! $this->canPublishFinanceReport($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $period = $request->input('period', 'month');
        try {
            [$from, $to] = $this->periodBounds($period);
        } catch (\InvalidArgumentException) {
            return response()->json(['message' => 'Invalid period'], 422);
        }

        $data = $request->validate([
            'note' => 'nullable|string|max:4000',
        ]);

        $orders = $this->accountantOrders();
        $filtered = $this->filterOrdersByUpdatedRange($orders, $from, $to);
        $aggregate = ReceiptPaymentAnalytics::aggregate($filtered, $to->copy());

        $pdf = Pdf::loadView('pdf.receipt-period', [
            'period' => $period,
            'from' => $from,
            'to' => $to,
            'totals' => $aggregate['allTime'],
            'byPaymentStatus' => $aggregate['byPaymentStatus'],
            'overdueCount' => $aggregate['overdueCount'],
            'overdueOutstanding' => $aggregate['overdueOutstanding'],
            'topOutstandingCustomers' => $aggregate['topOutstandingCustomers'],
        ]);
        $binary = $pdf->output();

        $path = 'admin-submissions/'.date('Y/m').'/finance-'.uniqid('', true).'.pdf';
        Storage::disk('local')->put($path, $binary);

        $submission = AdminSubmission::create([
            'submitted_by_id' => $user->id,
            'type' => AdminSubmission::TYPE_FINANCE_REPORT,
            'title' => 'Receipt & payment report ('.$period.')',
            'body' => $data['note'] ?? null,
            'attachment_disk' => 'local',
            'attachment_path' => $path,
            'metadata' => [
                'period' => $period,
                'from' => $from->toIso8601String(),
                'to' => $to->toIso8601String(),
                'totals' => $aggregate['allTime'],
            ],
            'status' => 'pending',
        ]);

        InAppNotifier::adminSubmissionPending($submission->fresh(['submitter:id,name']));

        return response()->json($submission->fresh(['submitter:id,name,email'])->toApiArray(), 201);
    }

    private function canAccessAccountantFinance(?User $user): bool
    {
        if (! $user) {
            return false;
        }
        if ($user->role === 'admin') {
            return true;
        }

        return $user->isAccountant();
    }

    private function canPublishFinanceReport(?User $user): bool
    {
        return $user && ($user->role === 'admin' || $user->isAccountant());
    }

    /** @return Collection<int, Order> */
    private function accountantOrders(): Collection
    {
        return Order::query()
            ->where('status', 'completed')
            ->whereNotNull('receipt_number')
            ->whereNotNull('total_amount')
            ->with(['task:id,title,customer_name,client_id', 'client:id,name,phone', 'creator:id,name'])
            ->get();
    }

    /** @return array{0: Carbon, 1: Carbon} */
    private function periodBounds(string $period): array
    {
        $now = Carbon::now();

        return match ($period) {
            'day' => [$now->copy()->startOfDay(), $now->copy()->endOfDay()],
            'week' => [$now->copy()->startOfWeek(), $now->copy()->endOfWeek()],
            'month' => [$now->copy()->startOfMonth(), $now->copy()->endOfMonth()],
            'year' => [$now->copy()->startOfYear(), $now->copy()->endOfYear()],
            default => throw new \InvalidArgumentException,
        };
    }

    /**
     * @param  Collection<int, Order>  $orders
     * @return Collection<int, Order>
     */
    private function filterOrdersByUpdatedRange(Collection $orders, Carbon $from, Carbon $to): Collection
    {
        return $orders->filter(function (Order $o) use ($from, $to) {
            return $o->updated_at->gte($from) && $o->updated_at->lte($to);
        });
    }

    private function manualCatalogRows(): array
    {
        ProductCategory::firstOrCreate(
            ['category_code' => 'ACCOUNTING'],
            ['category_name' => 'Accounting', 'sort_order' => 250]
        );
        $profile = Profile::firstOrCreate(
            ['profile_id' => 'MANUAL-SALE'],
            ['category_code' => 'ACCOUNTING', 'name' => 'Manual sale item', 'usage' => 'Accounting-only manual receipts']
        );
        $color = Color::firstOrCreate(
            ['color_code' => 'MANUAL'],
            ['name' => 'Manual', 'type' => 'accounting']
        );

        return [$profile, $color];
    }

    private function nextReceiptNumber(): string
    {
        $prefix = 'RCP-'.date('Y').'-';
        $last = Order::query()
            ->whereNotNull('receipt_number')
            ->where('receipt_number', 'like', $prefix.'%')
            ->orderByDesc('receipt_number')
            ->value('receipt_number');
        $n = 1;
        if ($last && preg_match('/-(\d+)$/', $last, $m)) {
            $n = (int) $m[1] + 1;
        }

        return $prefix.str_pad((string) $n, 5, '0', STR_PAD_LEFT);
    }

    private function orderToAccountantArray(Order $order): array
    {
        $order->loadMissing(['items.profile.category', 'items.color', 'creator:id,name', 'client:id,name,phone,email']);
        $total = $order->total_amount !== null ? (float) $order->total_amount : null;
        $paid = $order->amount_paid !== null ? (float) $order->amount_paid : null;

        return [
            'id' => (string) $order->id,
            'receiptNumber' => $order->receipt_number,
            'clientId' => $order->client_id ? (string) $order->client_id : null,
            'clientName' => $order->client?->name,
            'customerReference' => $order->customer_reference,
            'totalAmount' => $total,
            'amountPaid' => $paid,
            'balanceDue' => $total !== null ? round(max(0, $total - ($paid ?? 0)), 2) : null,
            'paymentStatus' => Order::derivePaymentStatus($total, $paid),
            'paymentDueAt' => $order->payment_due_at?->toDateString(),
            'paymentNotes' => $order->payment_notes,
            'currency' => $order->currency ?? 'ILS',
            'items' => $order->items->map(fn ($item) => [
                'id' => (string) $item->id,
                'description' => $item->notes ?: $item->profile?->name,
                'quantity' => (int) $item->quantity,
                'unitPrice' => $item->unit_price !== null ? (float) $item->unit_price : null,
                'lineTotal' => $item->line_total !== null ? (float) $item->line_total : null,
            ])->values(),
            'createdAt' => $order->created_at->toISOString(),
            'updatedAt' => $order->updated_at->toISOString(),
        ];
    }
}
