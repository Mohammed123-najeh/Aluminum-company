<?php

namespace Database\Seeders;

use App\Models\Inventory;
use Illuminate\Database\Seeder;

/**
 * Sets every inventory row to a random on-hand unit quantity (10–30).
 * Run after migrations or when stock was seeded as zero: php artisan db:seed --class=InventoryStockSeeder
 */
class InventoryStockSeeder extends Seeder
{
    public function run(): void
    {
        foreach (Inventory::cursor() as $inv) {
            $inv->quantity = random_int(10, 30);
            $inv->save();
        }
    }
}
