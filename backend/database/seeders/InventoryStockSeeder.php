<?php

namespace Database\Seeders;

use App\Models\Inventory;
use Illuminate\Database\Seeder;

/**
 * Sets every inventory row to a deterministic on-hand unit quantity (10–30),
 * derived from profile_id+color_code so re-runs (and collaborators) produce
 * the same numbers. Run: php artisan db:seed --class=InventoryStockSeeder
 */
class InventoryStockSeeder extends Seeder
{
    public function run(): void
    {
        Inventory::query()
            ->select(['id', 'profile_id', 'color_code'])
            ->cursor()
            ->each(function (Inventory $inv) {
                $qty = 10 + (crc32($inv->profile_id . ':' . $inv->color_code) % 21);
                Inventory::whereKey($inv->id)->update(['quantity' => $qty]);
            });
    }
}
