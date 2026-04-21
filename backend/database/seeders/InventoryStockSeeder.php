<?php

namespace Database\Seeders;

use App\Models\Inventory;
use Illuminate\Database\Seeder;

/**
 * Sets every inventory row to a random on-hand length (10–30 m).
 * Run after migrations or when stock was seeded as zero: php artisan db:seed --class=InventoryStockSeeder
 */
class InventoryStockSeeder extends Seeder
{
    public function run(): void
    {
        foreach (Inventory::cursor() as $inv) {
            $inv->quantity_m = round(random_int(10000, 30000) / 1000, 3);
            $inv->save();
        }
    }
}
