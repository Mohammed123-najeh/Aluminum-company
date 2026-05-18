<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('attendance_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('clock_in_at');
            $table->timestamp('clock_out_at')->nullable();
            $table->unsignedInteger('minutes_worked')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'clock_in_at']);
            $table->index('clock_in_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_logs');
    }
};
