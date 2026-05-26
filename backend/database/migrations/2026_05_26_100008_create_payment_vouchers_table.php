<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('payment_vouchers', function (Blueprint $table) {
            $table->id();
            $table->string('number', 40)->unique();
            $table->date('date');
            $table->string('payee_type', 16);
            $table->unsignedBigInteger('payee_id')->nullable();
            $table->string('payee_name')->nullable();
            $table->decimal('amount', 14, 2);
            $table->string('method', 30)->nullable();
            $table->string('reference_no', 80)->nullable();
            $table->text('purpose')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['payee_type', 'payee_id']);
            $table->index('date');
        });

        Schema::create('payment_voucher_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('voucher_id')->constrained('payment_vouchers')->cascadeOnDelete();
            $table->foreignId('invoice_id')->constrained('supplier_invoices')->cascadeOnDelete();
            $table->decimal('amount', 14, 2);
            $table->timestamps();

            $table->index('invoice_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_voucher_allocations');
        Schema::dropIfExists('payment_vouchers');
    }
};
