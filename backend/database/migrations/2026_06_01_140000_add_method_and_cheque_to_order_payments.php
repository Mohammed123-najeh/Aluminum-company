<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_payments', function (Blueprint $table) {
            $table->string('method', 30)->nullable()->after('amount');
            $table->string('cheque_bank', 120)->nullable()->after('method');
            $table->string('cheque_number', 80)->nullable()->after('cheque_bank');
            $table->string('cheque_holder', 160)->nullable()->after('cheque_number');
            $table->decimal('cheque_amount', 14, 2)->nullable()->after('cheque_holder');
            $table->date('cheque_issue_date')->nullable()->after('cheque_amount');
            $table->date('cheque_due_date')->nullable()->after('cheque_issue_date');
            $table->string('cheque_status', 20)->nullable()->after('cheque_due_date');
        });
    }

    public function down(): void
    {
        Schema::table('order_payments', function (Blueprint $table) {
            $table->dropColumn([
                'method', 'cheque_bank', 'cheque_number', 'cheque_holder',
                'cheque_amount', 'cheque_issue_date', 'cheque_due_date', 'cheque_status',
            ]);
        });
    }
};
