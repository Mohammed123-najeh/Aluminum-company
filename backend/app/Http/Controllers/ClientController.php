<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\Order;
use App\Models\User;
use Illuminate\Http\Request;

class ClientController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $q = $request->query('q');

        $query = Client::query()->orderBy('name');

        if ($user->role === 'admin') {
            // all
        } elseif ($user->role === 'supervisor') {
            $query->where('supervisor_id', $user->id);
        } else {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($q && is_string($q) && trim($q) !== '') {
            $needle = '%'.str_replace(['%', '_'], ['\\%', '\\_'], trim($q)).'%';
            $query->where(function ($w) use ($needle) {
                $w->where('name', 'like', $needle)
                    ->orWhere('phone', 'like', $needle)
                    ->orWhere('email', 'like', $needle);
            });
        }

        $clients = $query->get();

        // Heal stale orders whose client_id is missing but whose task has a client_id.
        $this->backfillMissingOrderClientIds($clients->pluck('id')->all());

        // Aggregate per-client totals so the list view shows order count / purchases / balance due
        // at a glance instead of always rendering zero until the detail panel loads.
        $analyticsByClient = $this->aggregateAnalyticsForClients($clients->pluck('id')->all());

        return response()->json($clients->map(function (Client $c) use ($analyticsByClient) {
            $row = $this->clientToArray($c);
            $row['analytics'] = $analyticsByClient[$c->id] ?? $this->emptyAnalytics();

            return $row;
        }));
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'supervisor') {
            return response()->json(['message' => 'Only supervisors can register clients'], 403);
        }

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:64',
            'email' => 'nullable|email|max:255',
            'notes' => 'nullable|string|max:10000',
        ]);

        $client = Client::create([
            'supervisor_id' => $user->id,
            'name' => $data['name'],
            'phone' => $data['phone'] ?? null,
            'email' => $data['email'] ?? null,
            'notes' => $data['notes'] ?? null,
        ]);

        return response()->json($this->clientToArray($client), 201);
    }

    public function show(Request $request, Client $client)
    {
        $user = $request->user();
        if (! $this->canAccessClient($user, $client)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $client->loadMissing('supervisor:id,name', 'accountantCreator:id,name');

        // Heal stale orders whose client_id is missing but whose task has a client_id.
        $this->backfillMissingOrderClientIds([$client->id]);

        $orders = Order::query()
            ->where('client_id', $client->id)
            ->with([
                'items.profile:id,profile_id,name,category_code',
                'items.profile.category:id,category_code,category_name',
                'items.color:color_code,name',
                'payments' => fn ($q) => $q->orderBy('paid_at'),
                'payments.recorder:id,name',
                'creator:id,name',
                'task:id,order_id,title,customer_name',
            ])
            ->orderByDesc('updated_at')
            ->get();

        // Active orders = anything not cancelled. Draft/in_progress orders represent committed
        // purchases — show them as outstanding balance so the supervisor can see what is owed
        // before the order is finalized into a receipt.
        $activeOrders = $orders->where('status', '!=', 'cancelled');
        $totalPurchases = (float) $activeOrders->sum(fn ($o) => (float) ($o->total_amount ?? 0));
        $totalPaid = (float) $activeOrders->sum(fn ($o) => (float) ($o->amount_paid ?? 0));
        $orderCount = $activeOrders->count();
        $balanceDue = round(max(0, $totalPurchases - $totalPaid), 2);

        $lastOrderAt = optional($orders->first())->updated_at;
        $lastPaymentAt = $orders
            ->flatMap(fn ($o) => $o->payments)
            ->sortByDesc('paid_at')
            ->first()
            ?->paid_at;

        $unitsPurchased = (int) $activeOrders
            ->flatMap(fn ($o) => $o->items)
            ->sum(fn ($i) => (int) ($i->quantity ?? 0));

        $tasks = $client->tasks()
            ->with(['assignees:id,name', 'order:id,status,total_amount,amount_paid'])
            ->orderByDesc('updated_at')
            ->get();

        return response()->json([
            'client' => $this->clientToArray($client),
            'analytics' => [
                'orderCount' => $orderCount,
                'totalOrderCount' => $orders->count(),
                'totalPurchases' => round($totalPurchases, 2),
                'totalPaid' => round($totalPaid, 2),
                'balanceDue' => $balanceDue,
                'unitsPurchased' => $unitsPurchased,
                'lastOrderAt' => $lastOrderAt?->toISOString(),
                'lastPaymentAt' => $lastPaymentAt?->toIso8601String(),
            ],
            'orders' => $orders->map(function (Order $o) {
                $total = $o->total_amount !== null ? (float) $o->total_amount : null;
                $paid = $o->amount_paid !== null ? (float) $o->amount_paid : 0.0;

                return [
                    'id' => (string) $o->id,
                    'status' => $o->status,
                    'receiptNumber' => $o->receipt_number,
                    'customerReference' => $o->customer_reference,
                    'totalAmount' => $total,
                    'amountPaid' => $paid,
                    'balanceDue' => $total !== null ? round(max(0, $total - $paid), 2) : null,
                    'paymentStatus' => Order::derivePaymentStatus($total, $paid),
                    'paymentDueAt' => $o->payment_due_at?->toDateString(),
                    'paymentNotes' => $o->payment_notes,
                    'currency' => $o->currency ?? 'ILS',
                    'createdAt' => $o->created_at->toISOString(),
                    'updatedAt' => $o->updated_at->toISOString(),
                    'creatorName' => $o->creator?->name,
                    'taskTitle' => $o->task?->title,
                    'items' => $o->items->map(fn ($i) => [
                        'id' => (string) $i->id,
                        'profileCode' => $i->profile?->profile_id,
                        'profileName' => $i->profile?->name,
                        'categoryName' => $i->profile?->category?->category_name,
                        'colorCode' => $i->color_code,
                        'colorName' => $i->color?->name,
                        'quantity' => (int) $i->quantity,
                        'unitPrice' => $i->unit_price !== null ? (float) $i->unit_price : null,
                        'lineTotal' => $i->line_total !== null ? (float) $i->line_total : null,
                        'notes' => $i->notes,
                    ])->values(),
                    'payments' => $o->payments->map(fn ($p) => $p->toApiArray())->values(),
                ];
            })->values(),
            'tasks' => $tasks->map(function ($t) {
                $o = $t->order;
                $total = $o && $o->total_amount !== null ? (float) $o->total_amount : null;
                $paid = $o ? (float) ($o->amount_paid ?? 0) : 0.0;
                return [
                    'id' => (string) $t->id,
                    'title' => $t->title,
                    'status' => $t->status,
                    'dueDate' => $t->due_date?->format('Y-m-d'),
                    'orderId' => $t->order_id ? (string) $t->order_id : null,
                    'orderStatus' => $o?->status,
                    'totalAmount' => $total,
                    'amountPaid' => $paid,
                    'balanceDue' => $total !== null ? round(max(0, $total - $paid), 2) : null,
                    'paymentStatus' => Order::derivePaymentStatus($total, $paid),
                    'assignees' => $t->assignees->map(fn ($a) => ['id' => (string) $a->id, 'name' => $a->name])->values(),
                    'createdAt' => $t->created_at->toISOString(),
                    'updatedAt' => $t->updated_at->toISOString(),
                ];
            })->values(),
        ]);
    }

    public function update(Request $request, Client $client)
    {
        $user = $request->user();
        if ($user->role !== 'supervisor' || (int) $client->supervisor_id !== (int) $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'phone' => 'nullable|string|max:64',
            'email' => 'nullable|email|max:255',
            'notes' => 'nullable|string|max:10000',
        ]);

        if (isset($data['name'])) {
            $client->name = $data['name'];
        }
        if (array_key_exists('phone', $data)) {
            $client->phone = $data['phone'];
        }
        if (array_key_exists('email', $data)) {
            $client->email = $data['email'];
        }
        if (array_key_exists('notes', $data)) {
            $client->notes = $data['notes'];
        }
        $client->save();

        return response()->json($this->clientToArray($client->fresh()));
    }

    public function destroy(Request $request, Client $client)
    {
        $user = $request->user();
        if ($user->role !== 'supervisor' || (int) $client->supervisor_id !== (int) $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $client->delete();

        return response()->json(null, 204);
    }

    /**
     * If a task carries a client_id but the linked order does not, propagate it. This keeps
     * the client section in sync when a supervisor attaches a client to a task *after* the
     * draft order was already created (or when an employee created the order without one).
     *
     * @param  array<int|string>  $clientIds
     */
    private function backfillMissingOrderClientIds(array $clientIds): void
    {
        if (empty($clientIds)) {
            return;
        }
        Order::query()
            ->whereNull('client_id')
            ->whereHas('task', fn ($q) => $q->whereIn('client_id', $clientIds))
            ->with('task:id,order_id,client_id')
            ->get()
            ->each(function (Order $o) {
                $cid = $o->task?->client_id;
                if ($cid) {
                    $o->client_id = $cid;
                    $o->save();
                }
            });
    }

    /**
     * @param  array<int|string>  $clientIds
     * @return array<string, array<string, mixed>>
     */
    private function aggregateAnalyticsForClients(array $clientIds): array
    {
        if (empty($clientIds)) {
            return [];
        }

        $orders = Order::query()
            ->whereIn('client_id', $clientIds)
            ->where('status', '!=', 'cancelled')
            ->get(['id', 'client_id', 'status', 'total_amount', 'amount_paid', 'updated_at']);

        $result = [];
        foreach ($orders->groupBy('client_id') as $cid => $group) {
            $totalPurchases = (float) $group->sum(fn ($o) => (float) ($o->total_amount ?? 0));
            $totalPaid = (float) $group->sum(fn ($o) => (float) ($o->amount_paid ?? 0));
            $balanceDue = round(max(0, $totalPurchases - $totalPaid), 2);
            $last = $group->sortByDesc('updated_at')->first();
            $result[(string) $cid] = [
                'orderCount' => $group->count(),
                'totalPurchases' => round($totalPurchases, 2),
                'totalPaid' => round($totalPaid, 2),
                'balanceDue' => $balanceDue,
                'lastOrderAt' => $last?->updated_at?->toISOString(),
            ];
        }

        return $result;
    }

    private function emptyAnalytics(): array
    {
        return [
            'orderCount' => 0,
            'totalPurchases' => 0,
            'totalPaid' => 0,
            'balanceDue' => 0,
            'lastOrderAt' => null,
        ];
    }

    private function canAccessClient(User $user, Client $client): bool
    {
        if ($user->role === 'admin' || $user->isAccountant()) {
            return true;
        }
        if ($user->role === 'supervisor' && (int) $client->supervisor_id === (int) $user->id) {
            return true;
        }

        return false;
    }

    private function clientToArray(Client $c): array
    {
        return [
            'id' => (string) $c->id,
            'supervisorId' => $c->supervisor_id ? (string) $c->supervisor_id : null,
            'supervisorName' => $c->relationLoaded('supervisor') ? $c->supervisor?->name : null,
            'source' => $c->source ?? null,
            'name' => $c->name,
            'phone' => $c->phone,
            'email' => $c->email,
            'notes' => $c->notes,
            'createdAt' => $c->created_at->toISOString(),
            'updatedAt' => $c->updated_at->toISOString(),
        ];
    }
}
