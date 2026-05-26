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
        // Default expense categories
        $cats = [
            ['name_ar' => 'مواد خام',          'name_en' => 'Raw materials'],
            ['name_ar' => 'رواتب',             'name_en' => 'Salaries'],
            ['name_ar' => 'إيجارات',           'name_en' => 'Rent'],
            ['name_ar' => 'كهرباء ومياه',      'name_en' => 'Utilities'],
            ['name_ar' => 'صيانة',             'name_en' => 'Maintenance'],
            ['name_ar' => 'نقل',               'name_en' => 'Transport'],
            ['name_ar' => 'تسويق',             'name_en' => 'Marketing'],
            ['name_ar' => 'مستلزمات مكتبية',  'name_en' => 'Office supplies'],
            ['name_ar' => 'أخرى',              'name_en' => 'Other'],
        ];
        foreach ($cats as $i => $c) {
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
