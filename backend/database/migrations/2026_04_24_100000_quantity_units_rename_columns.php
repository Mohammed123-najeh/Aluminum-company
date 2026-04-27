<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Stock and order line amounts: integer unit quantity (not meters);
 * order_items: unit_price per unit.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('inventory')) {
            return;
        }

        // ---- inventory: quantity_m → quantity (unsigned integer) ----
        if (Schema::hasColumn('inventory', 'quantity_m') && ! Schema::hasColumn('inventory', 'quantity')) {
            Schema::table('inventory', function (Blueprint $table) {
                $table->unsignedInteger('quantity')->default(0);
            });
            $rows = DB::table('inventory')->select('id', 'quantity_m')->get();
            foreach ($rows as $row) {
                $q = (float) $row->quantity_m;
                $units = (int) max(0, round($q));
                DB::table('inventory')->where('id', $row->id)->update(['quantity' => $units]);
            }
            Schema::table('inventory', function (Blueprint $table) {
                $table->dropColumn('quantity_m');
            });
        }

        // ---- order_items: quantity_m → quantity, unit_price_per_m → unit_price ----
        if (Schema::hasTable('order_items') && Schema::hasColumn('order_items', 'quantity_m')) {
            if (! Schema::hasColumn('order_items', 'quantity')) {
                Schema::table('order_items', function (Blueprint $table) {
                    $table->unsignedInteger('quantity')->default(0);
                });
            }
            if (! Schema::hasColumn('order_items', 'unit_price')) {
                Schema::table('order_items', function (Blueprint $table) {
                    $table->decimal('unit_price', 14, 4)->nullable();
                });
            }
            if (Schema::hasColumn('order_items', 'unit_price_per_m')) {
                $rows = DB::table('order_items')->select('id', 'unit_price_per_m')->get();
                foreach ($rows as $row) {
                    if ($row->unit_price_per_m !== null) {
                        DB::table('order_items')->where('id', $row->id)->update([
                            'unit_price' => (string) $row->unit_price_per_m,
                        ]);
                    }
                }
            }
            $rows = DB::table('order_items')->select('id', 'quantity_m')->get();
            foreach ($rows as $row) {
                $q = (float) $row->quantity_m;
                $units = (int) max(0, round($q));
                if ($units < 1 && $q > 0.0001) {
                    $units = 1;
                }
                DB::table('order_items')->where('id', $row->id)->update(['quantity' => $units]);
            }
            Schema::table('order_items', function (Blueprint $table) {
                $table->dropColumn('quantity_m');
            });
            if (Schema::hasColumn('order_items', 'unit_price_per_m')) {
                Schema::table('order_items', function (Blueprint $table) {
                    $table->dropColumn('unit_price_per_m');
                });
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('inventory') && Schema::hasColumn('inventory', 'quantity') && ! Schema::hasColumn('inventory', 'quantity_m')) {
            Schema::table('inventory', function (Blueprint $table) {
                $table->decimal('quantity_m', 12, 3)->default(0);
            });
            $rows = DB::table('inventory')->select('id', 'quantity')->get();
            foreach ($rows as $row) {
                DB::table('inventory')->where('id', $row->id)->update(['quantity_m' => (float) $row->quantity]);
            }
            Schema::table('inventory', function (Blueprint $table) {
                $table->dropColumn('quantity');
            });
        }
        if (Schema::hasTable('order_items') && Schema::hasColumn('order_items', 'quantity') && ! Schema::hasColumn('order_items', 'quantity_m')) {
            Schema::table('order_items', function (Blueprint $table) {
                $table->decimal('quantity_m', 12, 3);
                $table->decimal('unit_price_per_m', 14, 4)->nullable();
            });
            $rows = DB::table('order_items')->select('id', 'quantity', 'unit_price')->get();
            foreach ($rows as $row) {
                DB::table('order_items')->where('id', $row->id)->update([
                    'quantity_m' => (float) $row->quantity,
                    'unit_price_per_m' => $row->unit_price,
                ]);
            }
            Schema::table('order_items', function (Blueprint $table) {
                $table->dropColumn(['quantity', 'unit_price']);
            });
        }
    }
};
