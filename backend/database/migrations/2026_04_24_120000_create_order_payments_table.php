<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->decimal('amount', 14, 2);
            $table->timestamp('paid_at');
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('note', 2000)->nullable();
            $table->timestamps();
        });

        // Backfill from existing cumulative amount_paid (one synthetic row per completed order with balance)
        if (Schema::hasTable('orders')) {
            $orders = DB::table('orders')
                ->where('status', 'completed')
                ->whereNotNull('amount_paid')
                ->where('amount_paid', '>', 0)
                ->get(['id', 'amount_paid', 'updated_at', 'creator_id']);

            foreach ($orders as $o) {
                DB::table('order_payments')->insert([
                    'order_id' => $o->id,
                    'amount' => $o->amount_paid,
                    'paid_at' => $o->updated_at ?? now(),
                    'recorded_by' => $o->creator_id,
                    'note' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('order_payments');
    }
};
