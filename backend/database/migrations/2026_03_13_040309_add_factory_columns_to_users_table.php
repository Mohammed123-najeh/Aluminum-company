<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->enum('role', ['admin', 'supervisor', 'employee'])->default('employee')->after('email');
            $table->enum('employee_type', ['accountant', 'sales', 'hr'])->nullable()->after('role');
            $table->unsignedBigInteger('supervisor_id')->nullable()->after('employee_type');
            $table->foreign('supervisor_id')->references('id')->on('users')->nullOnDelete();
            $table->enum('status', ['active', 'suspended'])->default('active')->after('supervisor_id');
            $table->timestamp('last_login_at')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['supervisor_id']);
            $table->dropColumn(['role', 'employee_type', 'supervisor_id', 'status', 'last_login_at']);
        });
    }
};
