<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItem extends Model
{
    protected $fillable = [
        'order_id',
        'profile_id',
        'color_code',
        'quantity_m',
        'notes',
        'unit_price_per_m',
        'line_total',
    ];

    protected function casts(): array
    {
        return [
            'quantity_m' => 'decimal:3',
            'unit_price_per_m' => 'decimal:4',
            'line_total' => 'decimal:2',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
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
