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
}
