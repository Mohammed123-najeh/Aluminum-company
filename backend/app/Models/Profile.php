<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Profile extends Model
{
    protected $fillable = [
        'profile_id',
        'category_code',
        'name',
        'thickness_mm',
        'weight_kg_per_m',
        'usage',
    ];

    protected function casts(): array
    {
        return [
            'thickness_mm' => 'decimal:2',
            'weight_kg_per_m' => 'decimal:3',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class, 'category_code', 'category_code');
    }

    public function inventory(): HasMany
    {
        return $this->hasMany(Inventory::class);
    }
}
