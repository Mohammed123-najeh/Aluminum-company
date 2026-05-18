<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Inventory extends Model
{
    protected $table = 'inventory';

    protected $fillable = [
        'profile_id',
        'color_code',
        'quantity',
        'unit_price',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'unit_price' => 'decimal:2',
        ];
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(Profile::class);
    }

    public function color(): BelongsTo
    {
        return $this->belongsTo(Color::class, 'color_code', 'color_code');
    }
}
