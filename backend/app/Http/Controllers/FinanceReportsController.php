<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use App\Models\FinanceTransaction;
use App\Models\Order;
use App\Models\OrderPayment;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;

/**
 * Six downloadable PDF reports for the Finance Center "Reports" tab:
 *  - today / month       : revenue + expenses + net snapshot
 *  - revenue / expenses  : full transaction breakdown for the month
 *  - debts               : outstanding customer balances (with aging)
 *  - payments            : every OrderPayment recorded this month
 *
 * Every report uses the shared Blade view `pdf.fin-report` so layout is
 * consistent. Only Finance accountants + admins can pull these — gated by
 * the same role check the rest of FinanceCenterController uses.
 */
class FinanceReportsController extends Controller
{
    private function gate(Request $request)
    {
        $u = $request->user();
        if ($u->role === 'admin') return null;
        if ($u->role === 'employee' && $u->employee_type === 'accountant') return null;
        return response()->json(['message' => 'Forbidden'], 403);
    }

    /**
     * Generate one of the six reports. The `kind` query parameter selects
     * the report; everything else is computed server-side.
     */
    public function download(Request $request, string $kind)
    {
        if ($r = $this->gate($request)) return $r;

        $now = Carbon::now();

        $context = match ($kind) {
            'today' => $this->buildSummary($now->copy()->startOfDay(), $now->copy()->endOfDay(), 'today'),
            'month' => $this->buildSummary($now->copy()->startOfMonth(), $now->copy()->endOfDay(), 'month'),
            'revenue' => $this->buildRevenue($now->copy()->startOfMonth(), $now->copy()->endOfDay()),
            'expenses' => $this->buildExpenses($now->copy()->startOfMonth(), $now->copy()->endOfDay()),
            'debts' => $this->buildDebts($now),
            'payments' => $this->buildPayments($now->copy()->startOfMonth(), $now->copy()->endOfDay()),
            default => null,
        };

        if (! $context) {
            return response()->json(['message' => 'Unknown report kind'], 422);
        }

        $pdf = Pdf::loadView('pdf.fin-report', $context);
        $filename = "finance-{$kind}-{$now->format('Y-m-d')}.pdf";

        return $pdf->download($filename);
    }

    /**
     * Today / month snapshot: revenue + expenses + net.
     */
    private function buildSummary(Carbon $from, Carbon $to, string $kind): array
    {
        $revenue = (float) FinanceTransaction::where('type', 'revenue')
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->sum('amount');

        $expenseFromTable = (float) Expense::whereIn('status', ['approved', 'paid'])
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->sum('amount');
        $manualPayments = (float) FinanceTransaction::where('type', 'payment')
            ->where(function ($q) {
                $q->whereNull('ref_type')->orWhere('ref_type', '!=', 'expense');
            })
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->sum('amount');
        $expense = $expenseFromTable + $manualPayments;

        return [
            'title' => $kind === 'today' ? 'Daily report' : 'Monthly report',
            'period' => $from->toDateString() . ' → ' . $to->toDateString(),
            'sections' => [[
                'heading' => 'Summary',
                'rows' => [
                    ['Revenue', number_format($revenue, 2) . ' ILS'],
                    ['Expenses', number_format($expense, 2) . ' ILS'],
                    ['Net', number_format($revenue - $expense, 2) . ' ILS'],
                ],
            ]],
        ];
    }

    private function buildRevenue(Carbon $from, Carbon $to): array
    {
        $rows = FinanceTransaction::where('type', 'revenue')
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->orderBy('date')
            ->get();

        $total = (float) $rows->sum('amount');

        return [
            'title' => 'Revenue report',
            'period' => $from->toDateString() . ' → ' . $to->toDateString(),
            'sections' => [[
                'heading' => 'Revenue transactions (' . $rows->count() . ')',
                'tableHeaders' => ['Date', 'Source', 'Party', 'Amount'],
                'tableRows' => $rows->map(fn ($t) => [
                    $t->date?->toDateString() ?? '—',
                    $t->source ?? '—',
                    $t->party_name ?? '—',
                    number_format((float) $t->amount, 2),
                ])->toArray(),
                'footer' => 'Total: ' . number_format($total, 2) . ' ILS',
            ]],
        ];
    }

    private function buildExpenses(Carbon $from, Carbon $to): array
    {
        $rows = Expense::with('category')
            ->whereIn('status', ['approved', 'paid'])
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->orderBy('date')
            ->get();

        $total = (float) $rows->sum('amount');

        return [
            'title' => 'Expenses report',
            'period' => $from->toDateString() . ' → ' . $to->toDateString(),
            'sections' => [[
                'heading' => 'Expenses (' . $rows->count() . ')',
                'tableHeaders' => ['Date', 'Category', 'Description', 'Amount'],
                'tableRows' => $rows->map(fn ($e) => [
                    $e->date?->toDateString() ?? '—',
                    $e->category?->name_en ?? $e->category?->name_ar ?? '—',
                    $e->description ?? '—',
                    number_format((float) $e->amount, 2),
                ])->toArray(),
                'footer' => 'Total: ' . number_format($total, 2) . ' ILS',
            ]],
        ];
    }

    private function buildDebts(Carbon $now): array
    {
        $orders = Order::where('status', '!=', 'cancelled')
            ->whereNotNull('total_amount')
            ->with(['client:id,name'])
            ->get()
            ->filter(function ($o) {
                $bal = (float) $o->total_amount - (float) ($o->amount_paid ?? 0);
                return $bal > 0.009;
            });

        $today = $now->toDateString();
        $rows = $orders->map(function ($o) use ($today) {
            $bal = (float) $o->total_amount - (float) ($o->amount_paid ?? 0);
            $due = $o->payment_due_at?->toDateString();
            return [
                $o->client?->name ?? $o->customer_reference ?? '—',
                'ORD-' . $o->id,
                number_format($bal, 2),
                $due ?? '—',
                $due && $due < $today ? 'Late' : 'Normal',
            ];
        })->values()->toArray();

        $total = $orders->sum(fn ($o) => (float) $o->total_amount - (float) ($o->amount_paid ?? 0));

        return [
            'title' => 'Outstanding debts report',
            'period' => 'As of ' . $today,
            'sections' => [[
                'heading' => 'Open debts (' . count($rows) . ')',
                'tableHeaders' => ['Customer', 'Order', 'Remaining', 'Due date', 'Status'],
                'tableRows' => $rows,
                'footer' => 'Total outstanding: ' . number_format($total, 2) . ' ILS',
            ]],
        ];
    }

    private function buildPayments(Carbon $from, Carbon $to): array
    {
        $rows = OrderPayment::query()
            ->whereBetween('paid_at', [$from, $to])
            ->with(['order:id,client_id,total_amount,customer_reference', 'order.client:id,name', 'recorder:id,name'])
            ->orderBy('paid_at')
            ->get();

        $tableRows = $rows->map(function ($p) {
            return [
                $p->paid_at?->toDateString() ?? '—',
                'PAY-' . str_pad((string) $p->id, 4, '0', STR_PAD_LEFT),
                'ORD-' . $p->order_id,
                $p->order?->client?->name ?? $p->order?->customer_reference ?? '—',
                ($p->amount < 0 ? '−' : '') . number_format(abs((float) $p->amount), 2),
                $p->recorder?->name ?? '—',
            ];
        })->toArray();

        $total = (float) $rows->sum('amount');

        return [
            'title' => 'Payments report',
            'period' => $from->toDateString() . ' → ' . $to->toDateString(),
            'sections' => [[
                'heading' => 'Customer payments (' . count($tableRows) . ')',
                'tableHeaders' => ['Date', 'Receipt #', 'Order', 'Customer', 'Amount', 'Recorded by'],
                'tableRows' => $tableRows,
                'footer' => 'Net total: ' . number_format($total, 2) . ' ILS',
            ]],
        ];
    }
}
