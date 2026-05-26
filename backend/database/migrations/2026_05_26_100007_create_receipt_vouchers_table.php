<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('receipt_vouchers', function (Blueprint $table) {
            $table->id();
            $table->string('number', 40)->unique();
            $table->date('date');
            $table->foreignId('client_id')->nullable()->constrained('clients')->nullOnDelete();
            $table->string('payer_name')->nullable();
            $table->decimal('amount', 14, 2);
            $table->string('method', 30)->nullable();
            $table->string('reference_no', 80)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['date', 'client_id']);
        });

        Schema::create('receipt_voucher_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('voucher_id')->constrained('receipt_vouchers')->cascadeOnDelete();
            $table->foreignId('invoice_id')->constrained('customer_invoices')->cascadeOnDelete();
            $table->decimal('amount', 14, 2);
            $table->timestamps();

            $table->index('invoice_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('receipt_voucher_allocations');
        Schema::dropIfExists('receipt_vouchers');
    }
};
