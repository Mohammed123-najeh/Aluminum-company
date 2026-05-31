<?php

namespace App\Http\Controllers;

use App\Models\AiConversation;
use App\Models\AiMessage;
use App\Models\CustomerInvoice;
use App\Models\Expense;
use App\Models\FinanceTransaction;
use App\Models\Inventory;
use App\Models\Message;
use App\Models\Order;
use App\Models\Task;
use App\Models\User;
use App\Support\ReceiptPaymentAnalytics;
use Carbon\Carbon;
use Illuminate\Http\Request;

class AdminAnalyticsController extends Controller
{



    public function index(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // Optional date-range filter: when both `from` and `to` are present, the page's
        // time-sensitive aggregations (finance KPIs, tasks/orders created in period,
        // messages in period, supervisor task counts) are scoped to that window.
        $now = Carbon::now();
        $rawFrom = $request->query('from');
        $rawTo = $request->query('to');
        $filterFrom = null;
        $filterTo = null;
        if ($rawFrom && $rawTo) {
            try {
                $filterFrom = Carbon::parse((string) $rawFrom)->startOfDay();
                $filterTo = Carbon::parse((string) $rawTo)->endOfDay();
                if ($filterFrom->gt($filterTo)) {
                    [$filterFrom, $filterTo] = [$filterTo->copy()->startOfDay(), $filterFrom->copy()->endOfDay()];
                }
            } catch (\Throwable $e) {
                $filterFrom = null;
                $filterTo = null;
            }
        }
        $filtered = $filterFrom !== null && $filterTo !== null;

        $nonAdmin = User::query()->where('role', '!=', 'admin')->get();
        $supervisors = User::query()->where('role', 'supervisor')->orderBy('name')->get();
        $employees = User::query()->where('role', 'employee')->get();

        $usersBlock = [
            'totalNonAdmin' => $nonAdmin->count(),
            'supervisors' => $supervisors->count(),
            'employees' => $employees->count(),
            'active' => $nonAdmin->where('status', 'active')->count(),
            'suspended' => $nonAdmin->where('status', 'suspended')->count(),
            'employeesWithoutSupervisor' => $employees->whereNull('supervisor_id')->count(),
            'employeeTypes' => [
                'accountant' => $employees->where('employee_type', 'accountant')->count(),
                'sales' => $employees->where('employee_type', 'sales')->count(),
                'hr' => $employees->where('employee_type', 'hr')->count(),
                'unset' => $employees->whereNull('employee_type')->count(),
            ],
        ];

        $supervisorTeams = $supervisors->map(function (User $s) {
            $team = User::query()
                ->where('supervisor_id', $s->id)
                ->where('role', 'employee');

            return [
                'id' => (string) $s->id,
                'name' => $s->name,
                'email' => $s->email,
                'teamSize' => (clone $team)->count(),
                'activeEmployees' => (clone $team)->where('status', 'active')->count(),
            ];
        })->sortByDesc('teamSize')->values()->all();

        // Tasks: filter by creation date when a range is active.
        $tasksQ = Task::query();
        if ($filtered) {
            $tasksQ->whereBetween('created_at', [$filterFrom, $filterTo]);
        }
        $tasks = $tasksQ->get();
        $overdue = $tasks->filter(function (Task $t) use ($now) {
            if (! $t->due_date) {
                return false;
            }
            if (in_array($t->status, ['completed', 'cancelled'], true)) {
                return false;
            }

            return $t->due_date->copy()->endOfDay()->lt($now);
        })->count();

        $tasksBlock = [
            'total' => $tasks->count(),
            'overdue' => $overdue,
            'byStatus' => [
                'pending' => $tasks->where('status', 'pending')->count(),
                'in_progress' => $tasks->where('status', 'in_progress')->count(),
                'completed' => $tasks->where('status', 'completed')->count(),
                'cancelled' => $tasks->where('status', 'cancelled')->count(),
            ],
        ];

        $tasksBySupervisor = $supervisors->map(function (User $s) use ($tasks) {
            $mine = $tasks->where('supervisor_id', $s->id);

            return [
                'supervisorId' => (string) $s->id,
                'supervisorName' => $s->name,
                'total' => $mine->count(),
                'completed' => $mine->where('status', 'completed')->count(),
                'inProgress' => $mine->where('status', 'in_progress')->count(),
                'pending' => $mine->where('status', 'pending')->count(),
            ];
        })->sortByDesc('total')->values()->all();

        $ordersQ = Order::query();
        if ($filtered) {
            $ordersQ->whereBetween('created_at', [$filterFrom, $filterTo]);
        }
        $orders = $ordersQ->get();
        $orderStatuses = ['draft', 'submitted', 'in_progress', 'completed', 'cancelled'];
        $byOrderStatus = [];
        foreach ($orderStatuses as $st) {
            $byOrderStatus[$st] = $orders->where('status', $st)->count();
        }
        $ordersBlock = [
            'total' => $orders->count(),
            'byStatus' => $byOrderStatus,
        ];

        // Messages: total stays as the all-time count; "last7Days" is the count for the
        // active range when filtered, or literally the last 7 days when unfiltered.
        $messageRangeCount = $filtered
            ? Message::query()->whereBetween('created_at', [$filterFrom, $filterTo])->count()
            : Message::query()->where('created_at', '>=', $now->copy()->subDays(7))->count();
        $messagesBlock = [
            'total' => Message::query()->count(),
            'last7Days' => $messageRangeCount,
        ];

        $inventoryRows = Inventory::query()->count();
        $inventoryTotalUnits = (int) (Inventory::query()->sum('quantity') ?? 0);

        $aiBlock = [
            'conversations' => AiConversation::query()->count(),
            'aiMessages' => AiMessage::query()->count(),
        ];

        $receiptOrdersQ = Order::query()
            ->where('status', 'completed')
            ->whereNotNull('receipt_number')
            ->whereNotNull('total_amount')
            ->with(['task:id,title,customer_name,client_id', 'client:id,name,phone']);
        if ($filtered) {
            $receiptOrdersQ->whereBetween('updated_at', [$filterFrom, $filterTo]);
        }
        $receiptOrders = $receiptOrdersQ->get();

        $receiptKpis = ReceiptPaymentAnalytics::aggregate($receiptOrders, $now);

        // ── Finance KPIs (revenue / expense / net — today, month, with deltas) ──
        // Revenue: finance_transactions.type='revenue' (auto-emitted from receipt vouchers).
        // Expenses: every Expense row whose status is approved or paid (so water/electricity/etc.
        //  are counted as soon as approved, even before the bookkeeper marks them paid),
        //  PLUS finance_transactions.type='payment' rows that are NOT mirroring an Expense
        //  (so manual payment vouchers and salary payouts still count without double-counting).
        $today = $now->copy()->startOfDay();
        $todayEnd = $now->copy()->endOfDay();
        $monthStart = $now->copy()->startOfMonth();
        $yesterdayStart = $now->copy()->subDay()->startOfDay();
        $yesterdayEnd = $now->copy()->subDay()->endOfDay();
        $lastMonthStart = $now->copy()->subMonthNoOverflow()->startOfMonth();
        $lastMonthEnd = $now->copy()->subMonthNoOverflow()->endOfMonth();

        $revenueIn = function (Carbon $from, Carbon $to): float {
            return (float) FinanceTransaction::where('type', 'revenue')
                ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
                ->sum('amount');
        };

        $expenseIn = function (Carbon $from, Carbon $to): float {
            $fromDate = $from->toDateString();
            $toDate = $to->toDateString();
            $opExpenses = (float) Expense::whereIn('status', ['approved', 'paid'])
                ->whereBetween('date', [$fromDate, $toDate])
                ->sum('amount');
            $manualPayments = (float) FinanceTransaction::where('type', 'payment')
                ->where(function ($q) {
                    $q->whereNull('ref_type')->orWhere('ref_type', '!=', 'expense');
                })
                ->whereBetween('date', [$fromDate, $toDate])
                ->sum('amount');
            return $opExpenses + $manualPayments;
        };

        $revenueToday = $revenueIn($today, $todayEnd);
        $revenueYday = $revenueIn($yesterdayStart, $yesterdayEnd);
        $revenueMonth = $revenueIn($monthStart, $now);
        $revenueLastMonth = $revenueIn($lastMonthStart, $lastMonthEnd);

        $expenseToday = $expenseIn($today, $todayEnd);
        $expenseYday = $expenseIn($yesterdayStart, $yesterdayEnd);
        $expenseMonth = $expenseIn($monthStart, $now);
        $expenseLastMonth = $expenseIn($lastMonthStart, $lastMonthEnd);

        $netToday = $revenueToday - $expenseToday;
        $netYday = $revenueYday - $expenseYday;
        $netMonth = $revenueMonth - $expenseMonth;
        $netLastMonth = $revenueLastMonth - $expenseLastMonth;

        $pctDelta = function (float $cur, float $prev): ?float {
            if (abs($prev) < 0.01) return null;
            return round((($cur - $prev) / abs($prev)) * 100, 1);
        };

        $unpaidOrdersCount = CustomerInvoice::whereNotIn('status', ['paid', 'cancelled'])
            ->where('balance', '>', 0)
            ->count();

        if ($filtered) {
            // Compare to the immediately-preceding window of the same length.
            $rangeDays = (int) floor($filterFrom->diffInDays($filterTo)) + 1;
            $prevTo = $filterFrom->copy()->subDay()->endOfDay();
            $prevFrom = $prevTo->copy()->subDays($rangeDays - 1)->startOfDay();

            $revRange = $revenueIn($filterFrom, $filterTo);
            $revPrev = $revenueIn($prevFrom, $prevTo);
            $expRange = $expenseIn($filterFrom, $filterTo);
            $expPrev = $expenseIn($prevFrom, $prevTo);
            $netRange = $revRange - $expRange;
            $netPrev = $revPrev - $expPrev;

            $financeKpi = [
                'mode' => 'range',
                'range' => [
                    'from' => $filterFrom->toDateString(),
                    'to' => $filterTo->toDateString(),
                    'days' => $rangeDays,
                    'revenue' => ['value' => $revRange, 'prev' => $revPrev, 'deltaPct' => $pctDelta($revRange, $revPrev)],
                    'expense' => ['value' => $expRange, 'prev' => $expPrev, 'deltaPct' => $pctDelta($expRange, $expPrev)],
                    'net' => ['value' => $netRange, 'prev' => $netPrev, 'deltaPct' => $pctDelta($netRange, $netPrev)],
                ],
                'unpaidOrdersCount' => $unpaidOrdersCount,
            ];
        } else {
            $financeKpi = [
                'mode' => 'fixed',
                'revenueToday' => ['value' => $revenueToday, 'prev' => $revenueYday, 'deltaPct' => $pctDelta($revenueToday, $revenueYday)],
                'revenueMonth' => ['value' => $revenueMonth, 'prev' => $revenueLastMonth, 'deltaPct' => $pctDelta($revenueMonth, $revenueLastMonth)],
                'expenseToday' => ['value' => $expenseToday, 'prev' => $expenseYday, 'deltaPct' => $pctDelta($expenseToday, $expenseYday)],
                'expenseMonth' => ['value' => $expenseMonth, 'prev' => $expenseLastMonth, 'deltaPct' => $pctDelta($expenseMonth, $expenseLastMonth)],
                'netToday' => ['value' => $netToday, 'prev' => $netYday, 'deltaPct' => $pctDelta($netToday, $netYday)],
                'netMonth' => ['value' => $netMonth, 'prev' => $netLastMonth, 'deltaPct' => $pctDelta($netMonth, $netLastMonth)],
                'unpaidOrdersCount' => $unpaidOrdersCount,
            ];
        }

        return response()->json([
            'generatedAt' => $now->toIso8601String(),
            'users' => $usersBlock,
            'supervisorTeams' => $supervisorTeams,
            'tasks' => $tasksBlock,
            'tasksBySupervisor' => $tasksBySupervisor,
            'orders' => $ordersBlock,
            'messages' => $messagesBlock,
            'storehouse' => [
                'inventoryRows' => $inventoryRows,
                'totalQuantityUnits' => $inventoryTotalUnits,
            ],
            'ai' => $aiBlock,
            'financeKpi' => $financeKpi,
            'financial' => [
                'receiptsAnalyzedAt' => $receiptKpis['generatedAt'],
                'completedReceiptsCount' => $receiptKpis['allTime']['count'],
                'totalBilledAllTime' => $receiptKpis['allTime']['totalBilled'],
                'totalPaidAllTime' => $receiptKpis['allTime']['totalPaid'],
                'totalOutstandingAllTime' => $receiptKpis['allTime']['totalOutstanding'],
                'byPaymentStatus' => $receiptKpis['byPaymentStatus'],
                'overdueReceiptsCount' => $receiptKpis['overdueCount'],
                'overdueOutstanding' => $receiptKpis['overdueOutstanding'],
                'customersWithOutstandingCount' => $receiptKpis['customersWithOutstandingCount'],
                'today' => $receiptKpis['today'],
                'thisMonth' => $receiptKpis['thisMonth'],
                'thisYear' => $receiptKpis['thisYear'],
                'dueNextMonth' => $receiptKpis['dueNextMonth'],
                'topOutstandingCustomers' => $receiptKpis['topOutstandingCustomers'],
            ],
        ]);
    }
}
