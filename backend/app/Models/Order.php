<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    protected $fillable = [
        'creator_id',
        'supervisor_id',
        'client_id',
        'status',
        'customer_reference',
        'total_amount',
        'amount_paid',
        'payment_due_at',
        'payment_notes',
        'currency',
        'receipt_number',
    ];

    protected function casts(): array
    {
        return [
            'total_amount' => 'decimal:2',
            'amount_paid' => 'decimal:2',
            'payment_due_at' => 'date',
        ];
    }

    /** @return 'paid'|'partial'|'unpaid'|'unknown' */
    public static function derivePaymentStatus(?float $total, ?float $paid): string
    {
        if ($total === null || $total <= 0) {
            return 'unknown';
        }
        $p = $paid ?? 0;
        if ($p >= $total - 0.009) {
            return 'paid';
        }
        if ($p > 0.009) {
            return 'partial';
        }

        return 'unpaid';
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function supervisor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supervisor_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(OrderPayment::class);
    }

    public function task(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(Task::class);
    }
}
