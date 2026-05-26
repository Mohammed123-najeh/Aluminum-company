<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('finance_transactions', function (Blueprint $table) {
            $table->id();
            $table->string('type', 16);
            $table->string('source', 40);
            $table->string('ref_type', 40)->nullable();
            $table->unsignedBigInteger('ref_id')->nullable();
            $table->string('party_type', 16)->nullable();
            $table->unsignedBigInteger('party_id')->nullable();
            $table->string('party_name')->nullable();
            $table->decimal('amount', 14, 2);
            $table->string('method', 30)->nullable();
            $table->string('reference_no', 80)->nullable();
            $table->date('date');
            $table->text('notes')->nullable();
            $table->string('status', 20)->default('completed');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['type', 'date']);
            $table->index(['ref_type', 'ref_id']);
            $table->unique(['ref_type', 'ref_id', 'type'], 'finance_tx_ref_type_uniq');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finance_transactions');
    }
};
