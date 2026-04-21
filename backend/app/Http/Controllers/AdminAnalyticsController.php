<?php

namespace App\Http\Controllers;

use App\Models\AiConversation;
use App\Models\AiMessage;
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

        $tasks = Task::query()->get();
        $now = Carbon::now();
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

        $orders = Order::query()->get();
        $orderStatuses = ['draft', 'submitted', 'in_progress', 'completed', 'cancelled'];
        $byOrderStatus = [];
        foreach ($orderStatuses as $st) {
            $byOrderStatus[$st] = $orders->where('status', $st)->count();
        }
        $ordersBlock = [
            'total' => $orders->count(),
            'byStatus' => $byOrderStatus,
        ];

        $messagesBlock = [
            'total' => Message::query()->count(),
            'last7Days' => Message::query()->where('created_at', '>=', $now->copy()->subDays(7))->count(),
        ];

        $inventoryRows = Inventory::query()->count();
        $inventoryTotalM = (float) (Inventory::query()->sum('quantity_m') ?? 0);

        $aiBlock = [
            'conversations' => AiConversation::query()->count(),
            'aiMessages' => AiMessage::query()->count(),
        ];

        $receiptOrders = Order::query()
            ->where('status', 'completed')
            ->whereNotNull('receipt_number')
            ->whereNotNull('total_amount')
            ->with(['task:id,title,customer_name,client_id', 'client:id,name,phone'])
            ->get();

        $receiptKpis = ReceiptPaymentAnalytics::aggregate($receiptOrders, $now);

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
                'totalQuantityM' => round($inventoryTotalM, 3),
            ],
            'ai' => $aiBlock,
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
