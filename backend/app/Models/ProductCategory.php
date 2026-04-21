<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductCategory extends Model
{
    protected $table = 'product_categories';

    protected $fillable = [
        'category_code',
        'category_name',
        'category_name_ar',
        'sort_order',
    ];

    public function profiles(): HasMany
    {
        return $this->hasMany(Profile::class, 'category_code', 'category_code');
    }
}
