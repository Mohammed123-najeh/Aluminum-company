<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExpenseCategory extends Model
{
    protected $fillable = ['name_ar', 'name_en', 'ordering', 'archived'];

    protected function casts(): array
    {
        return ['archived' => 'boolean', 'ordering' => 'integer'];
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class, 'category_id');
    }

    public function toApiArray(): array
    {
        return [
            'id' => (string) $this->id,
            'nameAr' => $this->name_ar,
            'nameEn' => $this->name_en,
            'ordering' => (int) $this->ordering,
            'archived' => (bool) $this->archived,
        ];
    }

    /**
     * Canonical list of default expense categories for this workshop.
     * Used by the seeder and by lazy auto-seeding when the table is empty.
     */
    public static function defaultCategories(): array
    {
        return [
            ['name_ar' => 'كهرباء',        'name_en' => 'Electricity'],
            ['name_ar' => 'ماء',           'name_en' => 'Water'],
            ['name_ar' => 'مواصلات',       'name_en' => 'Transport'],
            ['name_ar' => 'بضاعة',         'name_en' => 'Goods'],
            ['name_ar' => 'زجاج',          'name_en' => 'Glass'],
            ['name_ar' => 'ألمنيوم',       'name_en' => 'Aluminum'],
            ['name_ar' => 'صيانة',         'name_en' => 'Maintenance'],
            ['name_ar' => 'أدوات',         'name_en' => 'Tools'],
            ['name_ar' => 'رواتب',         'name_en' => 'Salaries'],
            ['name_ar' => 'إيجار',         'name_en' => 'Rent'],
            ['name_ar' => 'تسويق',         'name_en' => 'Marketing'],
            ['name_ar' => 'مصروفات أخرى',  'name_en' => 'Other expenses'],
        ];
    }

    /**
     * Ensure the canonical defaults exist and that their Arabic label +
     * ordering match the current canonical list. Idempotent — safe to
     * call on every request. Won't touch user-added categories.
     */
    public static function ensureDefaults(): void
    {
        foreach (self::defaultCategories() as $i => $c) {
            self::updateOrCreate(
                ['name_en' => $c['name_en']],
                ['name_ar' => $c['name_ar'], 'ordering' => $i, 'archived' => false],
            );
        }
    }
}
