<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * One-time backfill: copy the linked task's customer_name onto the order's
 * customer_reference for any order that has no name of its own. Finance reads the
 * customer name from the order (falling back to the task), so without this an
 * existing order whose name lived only on the task would go blank if that task is
 * ever deleted. Done in PHP for MySQL/SQLite portability. Idempotent.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('orders')
            ->join('tasks', 'tasks.order_id', '=', 'orders.id')
            ->whereNull('orders.client_id')
            ->where(function ($q) {
                $q->whereNull('orders.customer_reference')
                    ->orWhere('orders.customer_reference', '=', '');
            })
            ->whereNotNull('tasks.customer_name')
            ->where('tasks.customer_name', '!=', '')
            ->select('orders.id as order_id', 'tasks.customer_name as name')
            ->orderBy('orders.id')
            ->chunk(500, function ($rows) {
                foreach ($rows as $row) {
                    DB::table('orders')
                        ->where('id', $row->order_id)
                        ->update(['customer_reference' => $row->name]);
                }
            });
    }

    public function down(): void
    {
        // No-op: backfilled names are indistinguishable from manually-entered ones,
        // so we don't attempt to remove them on rollback.
    }
};
