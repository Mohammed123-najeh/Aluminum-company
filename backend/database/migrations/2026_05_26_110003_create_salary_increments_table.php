<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('salary_increments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('type', 20)->default('annual');
            $table->decimal('old_salary', 14, 2);
            $table->decimal('new_salary', 14, 2);
            $table->decimal('amount', 14, 2)->default(0);
            $table->decimal('percentage', 6, 3)->nullable();
            $table->date('effective_date');
            $table->text('reason')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('applied')->default(false);
            $table->timestamp('applied_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'effective_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('salary_increments');
    }
};
