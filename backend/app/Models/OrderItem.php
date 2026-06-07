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
        'quantity',
        'notes',
        'unit_price',
        'line_total',
        'is_cancelled',
        'cancelled_amount',
        'cancelled_at',
        'cancelled_by',
        'cancellation_reason',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'unit_price' => 'decimal:4',
            'line_total' => 'decimal:2',
            'is_cancelled' => 'boolean',
            'cancelled_amount' => 'decimal:2',
            'cancelled_at' => 'datetime',
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

    public function cancelledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }
}
