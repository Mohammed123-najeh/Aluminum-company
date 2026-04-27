<?php

namespace App\Services;

use App\Models\Inventory;
use App\Models\Order;
use App\Models\Profile;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AiContextBuilder
{
    /** @return array<string, mixed> */
    public function snapshotForChat(User $user): array
    {
        $now = Carbon::now();
        $today = $now->toDateString();

        $base = [
            'generatedAt' => $now->toIso8601String(),
            'viewer' => [
                'id' => (string) $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'status' => $user->status,
            ],
            'storehouse' => $this->storehouseStats(),
        ];

        return match ($user->role) {
            'admin' => array_merge($base, $this->adminScope()),
            'supervisor' => array_merge($base, $this->supervisorScope($user)),
            default => array_merge($base, $this->employeeScope($user, $today)),
        };
    }

    /** @return array<string, mixed> */
    public function snapshotForSummarizeToday(User $user): array
    {
        $snap = $this->snapshotForChat($user);
        $snap['summarizeFocus'] = 'today_work';
        $snap['todayDate'] = Carbon::now()->toDateString();

        return $snap;
    }

    /** @return array<string, mixed> */
    private function storehouseStats(): array
    {
        $profileCount = Profile::query()->count();
        $inventoryLines = Inventory::query()->count();
        $totalStockUnits = (int) (Inventory::query()->sum('quantity') ?? 0);

        return [
            'profileCount' => $profileCount,
            'inventoryLineCount' => $inventoryLines,
            'totalStockUnits' => $totalStockUnits,
            'note' => 'Products are profile+color combinations; inventory lines are stock rows.',
        ];
    }

    /** @return array<string, mixed> */
    private function adminScope(): array
    {
        $users = User::query()
            ->orderBy('name')
            ->limit(150)
            ->get(['id', 'name', 'email', 'role', 'status', 'supervisor_id']);

        $userRows = $users->map(fn ($u) => [
            'id' => (string) $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'role' => $u->role,
            'status' => $u->status,
            'supervisorId' => $u->supervisor_id ? (string) $u->supervisor_id : null,
        ])->values()->all();

        $roleCounts = User::query()
            ->select('role', DB::raw('count(*) as c'))
            ->groupBy('role')
            ->pluck('c', 'role')
            ->toArray();

        $taskStatus = Task::query()
            ->select('status', DB::raw('count(*) as c'))
            ->groupBy('status')
            ->pluck('c', 'status')
            ->toArray();

        $ordersTotal = Order::query()->count();

        return [
            'scope' => 'admin',
            'usersTotal' => User::query()->count(),
            'usersByRole' => $roleCounts,
            'usersSample' => $userRows,
            'tasksTotal' => Task::query()->count(),
            'tasksByStatus' => $taskStatus,
            'ordersTotal' => $ordersTotal,
        ];
    }

    /** @return array<string, mixed> */
    private function supervisorScope(User $user): array
    {
        $subordinates = $user->subordinates()->orderBy('name')->get(['id', 'name', 'email', 'status']);
        $subIds = $subordinates->pluck('id')->map(fn ($id) => (int) $id)->all();

        $teamTasks = Task::query()
            ->where('supervisor_id', $user->id)
            ->with('assignees:id,name')
            ->orderByDesc('updated_at')
            ->limit(80)
            ->get();

        $taskRows = $teamTasks->map(fn (Task $t) => $this->summarizeTask($t))->values()->all();

        $taskCountsByStatus = Task::query()
            ->where('supervisor_id', $user->id)
            ->select('status', DB::raw('count(*) as c'))
            ->groupBy('status')
            ->pluck('c', 'status')
            ->toArray();

        $employeeTaskStats = [];
        foreach ($subordinates as $emp) {
            $tid = (int) $emp->id;
            $employeeTaskStats[] = [
                'employeeId' => (string) $emp->id,
                'name' => $emp->name,
                'email' => $emp->email,
                'status' => $emp->status,
                'assignedTaskCount' => Task::query()
                    ->whereHas('assignees', fn ($q) => $q->where('user_id', $tid))
                    ->where('supervisor_id', $user->id)
                    ->count(),
            ];
        }

        $ordersScope = Order::query()
            ->where(function ($q) use ($user) {
                $q->where('supervisor_id', $user->id)->orWhere('creator_id', $user->id);
            })
            ->count();

        return [
            'scope' => 'supervisor',
            'teamSize' => count($subIds),
            'teamMembers' => $subordinates->map(fn ($u) => [
                'id' => (string) $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'status' => $u->status,
            ])->values()->all(),
            'tasksYouOwnCountsByStatus' => $taskCountsByStatus,
            'tasksYouOwnSample' => $taskRows,
            'perEmployeeTaskCounts' => $employeeTaskStats,
            'ordersInYourScopeApprox' => $ordersScope,
        ];
    }

    /** @return array<string, mixed> */
    private function employeeScope(User $user, string $today): array
    {
        $user->loadMissing('supervisor:id,name,email');

        $tasks = Task::query()
            ->whereHas('assignees', fn ($q) => $q->where('user_id', $user->id))
            ->with('assignees:id,name')
            ->orderByDesc('updated_at')
            ->limit(80)
            ->get();

        $taskRows = $tasks->map(fn (Task $t) => $this->summarizeTask($t))->values()->all();

        $byStatus = Task::query()
            ->whereHas('assignees', fn ($q) => $q->where('user_id', $user->id))
            ->select('status', DB::raw('count(*) as c'))
            ->groupBy('status')
            ->pluck('c', 'status')
            ->toArray();

        $openStatuses = [Task::STATUS_PENDING, Task::STATUS_IN_PROGRESS];
        $dueToday = Task::query()
            ->whereHas('assignees', fn ($q) => $q->where('user_id', $user->id))
            ->whereIn('status', $openStatuses)
            ->whereDate('due_date', $today)
            ->count();

        $overdue = Task::query()
            ->whereHas('assignees', fn ($q) => $q->where('user_id', $user->id))
            ->whereIn('status', $openStatuses)
            ->whereDate('due_date', '<', $today)
            ->count();

        $myOrders = Order::query()->where('creator_id', $user->id)->count();

        return [
            'scope' => 'employee',
            'dataFocus' => 'employee_self_service',
            'dataFocusNote' => 'Snapshot covers only this user’s assigned tasks and their own created orders; not other employees’ tasks.',
            'supervisor' => $user->supervisor
                ? [
                    'id' => (string) $user->supervisor->id,
                    'name' => $user->supervisor->name,
                    'email' => $user->supervisor->email,
                ]
                : null,
            'myTasksCountsByStatus' => $byStatus,
            'myTasksSample' => $taskRows,
            'dueTodayOpenCount' => $dueToday,
            'overdueOpenCount' => $overdue,
            'ordersICreatedCount' => $myOrders,
        ];
    }

    /** @return array<string, mixed> */
    private function summarizeTask(Task $t): array
    {
        $t->loadMissing('assignees:id,name');

        return [
            'id' => (string) $t->id,
            'title' => $t->title,
            'status' => $t->status,
            'dueDate' => $t->due_date?->format('Y-m-d'),
            'completedAt' => $t->completed_at?->toIso8601String(),
            'assigneeNames' => $t->assignees->pluck('name')->values()->all(),
            'hasLinkedOrder' => $t->order_id !== null,
        ];
    }
}
