<?php

namespace App\Http\Controllers;

use App\Models\Color;
use App\Models\Inventory;
use App\Models\ProductCategory;
use App\Models\Profile;
use App\Support\InventoryPricing;
use Illuminate\Http\Request;

class StorehouseController extends Controller
{
    public function categories()
    {
        $categories = ProductCategory::orderBy('sort_order')->get();
        return response()->json($categories->map(fn ($c) => [
            'id' => $c->id,
            'categoryCode' => $c->category_code,
            'categoryName' => $c->category_name,
            'categoryNameAr' => $c->category_name_ar,
            'sortOrder' => $c->sort_order,
        ]));
    }

    public function profiles(Request $request)
    {
        $query = Profile::with('category');
        $categoryCode = $request->query('category_code');
        if ($categoryCode) {
            $query->where('category_code', $categoryCode);
        }
        $profiles = $query->orderBy('profile_id')->get();
        return response()->json($profiles->map(fn ($p) => $this->profileToArray($p)));
    }

    public function updateProfile(Request $request, Profile $profile)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
        ]);
        $profile->name = $data['name'];
        $profile->save();
        $profile->load('category');

        return response()->json($this->profileToArray($profile));
    }

    private function profileToArray(Profile $p): array
    {
        return [
            'id' => $p->id,
            'profileId' => $p->profile_id,
            'categoryCode' => $p->category_code,
            'categoryName' => $p->category?->category_name,
            'name' => $p->name,
            'thicknessMm' => $p->thickness_mm ? (float) $p->thickness_mm : null,
            'weightKgPerM' => $p->weight_kg_per_m ? (float) $p->weight_kg_per_m : null,
            'usage' => $p->usage,
        ];
    }

    public function colors()
    {
        $colors = Color::orderBy('color_code')->get();
        return response()->json($colors->map(fn ($c) => [
            'id' => $c->id,
            'colorCode' => $c->color_code,
            'name' => $c->name,
            'type' => $c->type,
        ]));
    }

    public function inventory(Request $request)
    {
        $query = Inventory::with(['profile.category', 'color']);
        $profileId = $request->query('profile_id');
        if ($profileId) {
            $query->where('profile_id', $profileId);
        }
        $colorCode = $request->query('color_code');
        if ($colorCode) {
            $query->where('color_code', $colorCode);
        }
        $inventory = $query->get();

        // Hide unit prices from plain employees.
        $hidePrice = $request->user()?->role === 'employee';

        return response()->json($inventory->map(function ($i) use ($hidePrice) {
            $row = $this->inventoryRowToArray($i);
            if ($hidePrice) {
                $row['unitPrice'] = null;
            }

            return $row;
        }));
    }

    public function storeInventory(Request $request)
    {
        $data = $request->validate([
            'profile_id' => 'nullable|exists:profiles,id',
            'color_code' => 'nullable|string|max:30',
            'quantity' => 'required|integer|min:0',
            'unit_price' => 'nullable|numeric|min:0',
            'product_code' => 'nullable|string|max:30|unique:profiles,profile_id',
            'product_name' => 'nullable|string|max:255',
            'category_code' => 'nullable|exists:product_categories,category_code',
            'thickness_mm' => 'nullable|numeric|min:0',
            'weight_kg_per_m' => 'nullable|numeric|min:0',
            'usage' => 'nullable|string|max:255',
            'color_name' => 'nullable|string|max:255',
            'color_type' => 'nullable|string|max:20',
        ]);

        if (empty($data['profile_id'])) {
            if (empty($data['product_name']) || empty($data['category_code'])) {
                return response()->json(['message' => 'Product name and category are required for a new product.'], 422);
            }

            $profile = Profile::create([
                'profile_id' => $data['product_code'] ?? $this->nextProfileCode(),
                'category_code' => $data['category_code'],
                'name' => $data['product_name'],
                'thickness_mm' => $data['thickness_mm'] ?? null,
                'weight_kg_per_m' => $data['weight_kg_per_m'] ?? null,
                'usage' => $data['usage'] ?? null,
            ]);
            $data['profile_id'] = $profile->id;
        }

        if (empty($data['color_code'])) {
            if (empty($data['color_name'])) {
                return response()->json(['message' => 'Color is required.'], 422);
            }
            $data['color_code'] = $this->nextColorCode();
        }

        Color::firstOrCreate(
            ['color_code' => $data['color_code']],
            [
                'name' => $data['color_name'] ?? $data['color_code'],
                'type' => $data['color_type'] ?? null,
            ]
        );

        $dup = Inventory::where('profile_id', $data['profile_id'])->where('color_code', $data['color_code'])->first();
        if ($dup) {
            return response()->json(['message' => 'This profile and color already exist. Update quantity instead.'], 409);
        }

        $inv = Inventory::create([
            'profile_id' => $data['profile_id'],
            'color_code' => $data['color_code'],
            'quantity' => $data['quantity'],
            'unit_price' => $data['unit_price'] ?? null,
        ]);
        $inv->load(['profile.category', 'color']);

        return response()->json($this->inventoryRowToArray($inv), 201);
    }

    public function updateInventory(Request $request, Inventory $inventory)
    {
        $data = $request->validate([
            'profile_id' => 'required|exists:profiles,id',
            'color_code' => 'required|exists:colors,color_code',
            'quantity' => 'required|integer|min:0',
            'unit_price' => 'nullable|numeric|min:0',
        ]);

        $conflict = Inventory::query()
            ->where('profile_id', $data['profile_id'])
            ->where('color_code', $data['color_code'])
            ->where('id', '!=', $inventory->id)
            ->exists();

        if ($conflict) {
            return response()->json(['message' => 'Another stock line already uses this profile and color.'], 409);
        }

        $inventory->profile_id = $data['profile_id'];
        $inventory->color_code = $data['color_code'];
        $inventory->quantity = $data['quantity'];
        $inventory->unit_price = $data['unit_price'] ?? null;
        $inventory->save();
        $inventory->load(['profile.category', 'color']);

        return response()->json($this->inventoryRowToArray($inventory->fresh()));
    }

    public function destroyInventory(Inventory $inventory)
    {
        $inventory->delete();

        return response()->json(null, 204);
    }

    private function inventoryRowToArray(Inventory $i): array
    {
        $i->loadMissing(['profile.category', 'color']);

        return [
            'id' => $i->id,
            'profileId' => $i->profile_id,
            'profileCode' => $i->profile?->profile_id,
            'profileName' => $i->profile?->name,
            'categoryCode' => $i->profile?->category_code,
            'categoryName' => $i->profile?->category?->category_name,
            'thicknessMm' => $i->profile && $i->profile->thickness_mm !== null ? (float) $i->profile->thickness_mm : null,
            'weightKgPerM' => $i->profile && $i->profile->weight_kg_per_m !== null ? (float) $i->profile->weight_kg_per_m : null,
            'usage' => $i->profile?->usage,
            'colorCode' => $i->color_code,
            'colorName' => $i->color?->name,
            'quantity' => (int) $i->quantity,
            'unitPrice' => InventoryPricing::unitPrice($i),
        ];
    }

    private function nextProfileCode(): string
    {
        do {
            $code = 'CUSTOM-'.strtoupper(substr(uniqid('', true), -8));
        } while (Profile::query()->where('profile_id', $code)->exists());

        return $code;
    }

    private function nextColorCode(): string
    {
        do {
            $code = 'CLR-'.strtoupper(substr(uniqid('', true), -6));
        } while (Color::query()->where('color_code', $code)->exists());

        return $code;
    }
}
