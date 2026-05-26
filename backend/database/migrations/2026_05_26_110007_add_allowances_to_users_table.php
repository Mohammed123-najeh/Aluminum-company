<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('employee_number', 30)->nullable()->unique()->after('id');
            $table->json('allowances')->nullable()->after('annual_leave_balance');
            $table->string('national_id', 40)->nullable()->after('allowances');
            $table->string('nationality', 60)->nullable()->after('national_id');
            $table->date('birth_date')->nullable()->after('nationality');
            $table->string('gender', 10)->nullable()->after('birth_date');
            $table->string('marital_status', 20)->nullable()->after('gender');
            $table->unsignedTinyInteger('children_count')->nullable()->after('marital_status');
            $table->string('address')->nullable()->after('children_count');
            $table->string('phone', 40)->nullable()->after('address');
            $table->string('photo_path')->nullable()->after('phone');
            $table->date('hire_date')->nullable()->after('photo_path');
            $table->string('contract_type', 20)->nullable()->after('hire_date');
            $table->string('contract_duration', 40)->nullable()->after('contract_type');
            $table->string('bank_account', 60)->nullable()->after('contract_duration');
            $table->string('department', 80)->nullable()->after('bank_account');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'employee_number', 'allowances', 'national_id', 'nationality',
                'birth_date', 'gender', 'marital_status', 'children_count',
                'address', 'phone', 'photo_path', 'hire_date',
                'contract_type', 'contract_duration', 'bank_account', 'department',
            ]);
        });
    }
};
