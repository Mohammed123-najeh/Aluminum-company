<?php

namespace App\Http\Controllers;

use App\Models\AdminSubmission;
use App\Models\Order;
use App\Models\User;
use App\Services\InAppNotifier;
use App\Support\ReceiptPaymentAnalytics;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;

class AccountantFinanceController extends Controller
{
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
}
