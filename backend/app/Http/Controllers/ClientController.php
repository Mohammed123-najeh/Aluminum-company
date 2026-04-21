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

        return response()->json($clients->map(fn ($c) => $this->clientToArray($c)));
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

        $client->loadMissing('supervisor:id,name');

        $orders = Order::query()
            ->where('client_id', $client->id)
            ->where('status', 'completed')
            ->orderByDesc('updated_at')
            ->get(['id', 'total_amount', 'amount_paid', 'currency', 'receipt_number', 'creator_id', 'updated_at']);

        $totalPurchases = (float) $orders->sum(fn ($o) => (float) ($o->total_amount ?? 0));
        $totalPaid = (float) $orders->sum(fn ($o) => (float) ($o->amount_paid ?? 0));
        $orderCount = $orders->count();

        return response()->json([
            'client' => $this->clientToArray($client),
            'analytics' => [
                'orderCount' => $orderCount,
                'totalPurchases' => round($totalPurchases, 2),
                'totalPaid' => round($totalPaid, 2),
                'balanceDue' => round(max(0, $totalPurchases - $totalPaid), 2),
            ],
            'orders' => $orders->map(fn ($o) => [
                'id' => (string) $o->id,
                'receiptNumber' => $o->receipt_number,
                'totalAmount' => $o->total_amount !== null ? (float) $o->total_amount : null,
                'amountPaid' => $o->amount_paid !== null ? (float) $o->amount_paid : 0,
                'currency' => $o->currency ?? 'ILS',
                'updatedAt' => $o->updated_at->toISOString(),
            ])->values(),
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

    private function canAccessClient(User $user, Client $client): bool
    {
        if ($user->role === 'admin') {
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
            'supervisorId' => (string) $c->supervisor_id,
            'name' => $c->name,
            'phone' => $c->phone,
            'email' => $c->email,
            'notes' => $c->notes,
            'createdAt' => $c->created_at->toISOString(),
            'updatedAt' => $c->updated_at->toISOString(),
        ];
    }
}
