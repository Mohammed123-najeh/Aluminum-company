<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('work_schedule_settings', function (Blueprint $table) {
            $table->id();
            $table->time('work_start')->default('08:00:00');
            $table->time('work_end')->default('17:00:00');
            $table->unsignedSmallInteger('grace_minutes')->default(15);
            $table->json('work_days')->nullable();
            $table->decimal('late_deduction_per_minute', 8, 4)->default(0);
            $table->string('absence_deduction_formula', 30)->default('daily');
            $table->decimal('vat_rate', 5, 2)->default(15);
            $table->decimal('employee_insurance_pct', 5, 2)->default(0);
            $table->decimal('employer_insurance_pct', 5, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_schedule_settings');
    }
};
