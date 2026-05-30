<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Switch the company to hourly-pay only.
 *
 * - Backfill `users.hourly_rate` from any leftover `users.base_salary`
 *   (22 working days × 8 hours = 176 hours per month).
 * - Drop `users.base_salary` and `payslips.base_salary`. Payslips now
 *   carry the period's earned amount (hours × rate) under `earned_amount`.
 */
return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasColumn('users', 'base_salary') && Schema::hasColumn('users', 'hourly_rate')) {
            DB::statement("UPDATE users SET hourly_rate = ROUND(base_salary / 176, 2) WHERE (hourly_rate IS NULL OR hourly_rate = 0) AND base_salary IS NOT NULL AND base_salary > 0");
        }

        if (Schema::hasColumn('users', 'base_salary')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('base_salary');
            });
        }

        if (Schema::hasTable('payslips')) {
            if (!Schema::hasColumn('payslips', 'earned_amount')) {
                Schema::table('payslips', function (Blueprint $table) {
                    $table->decimal('earned_amount', 14, 2)->default(0)->after('user_id');
                });
                if (Schema::hasColumn('payslips', 'base_salary')) {
                    DB::statement('UPDATE payslips SET earned_amount = base_salary');
                }
            }
            if (Schema::hasColumn('payslips', 'base_salary')) {
                Schema::table('payslips', function (Blueprint $table) {
                    $table->dropColumn('base_salary');
                });
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('payslips') && !Schema::hasColumn('payslips', 'base_salary')) {
            Schema::table('payslips', function (Blueprint $table) {
                $table->decimal('base_salary', 14, 2)->default(0)->after('user_id');
            });
            if (Schema::hasColumn('payslips', 'earned_amount')) {
                DB::statement('UPDATE payslips SET base_salary = earned_amount');
            }
        }
        if (Schema::hasColumn('payslips', 'earned_amount')) {
            Schema::table('payslips', function (Blueprint $table) {
                $table->dropColumn('earned_amount');
            });
        }
        if (!Schema::hasColumn('users', 'base_salary')) {
            Schema::table('users', function (Blueprint $table) {
                $table->decimal('base_salary', 12, 2)->nullable()->after('main_job');
            });
        }
    }
};
