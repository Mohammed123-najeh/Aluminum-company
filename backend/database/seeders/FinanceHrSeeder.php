<?php

namespace Database\Seeders;

use App\Models\ExpenseCategory;
use App\Models\PublicHoliday;
use App\Models\Supplier;
use App\Models\WorkScheduleSetting;
use Illuminate\Database\Seeder;

class FinanceHrSeeder extends Seeder
{
    public function run(): void
    {
        foreach (ExpenseCategory::defaultCategories() as $i => $c) {
            ExpenseCategory::firstOrCreate(['name_en' => $c['name_en']], array_merge($c, ['ordering' => $i]));
        }

        // Work schedule defaults singleton
        WorkScheduleSetting::current();

        // Sample suppliers
        $suppliers = [
            ['name' => 'مصنع الألمنيوم الوطني',  'phone' => '+966-11-1111111', 'email' => 'sales@nat-alu.example.com'],
            ['name' => 'شركة الزجاج المتقدم',     'phone' => '+966-11-2222222', 'email' => 'info@adv-glass.example.com'],
        ];
        foreach ($suppliers as $s) {
            Supplier::firstOrCreate(['name' => $s['name']], $s);
        }

        // 2026 holidays (sample — KSA-aligned approximations)
        $holidays = [
            ['date' => '2026-02-22', 'name_ar' => 'يوم التأسيس',                'name_en' => 'Founding Day'],
            ['date' => '2026-09-23', 'name_ar' => 'اليوم الوطني',               'name_en' => 'National Day'],
        ];
        foreach ($holidays as $h) {
            PublicHoliday::firstOrCreate(['date' => $h['date']], $h);
        }
    }
}
