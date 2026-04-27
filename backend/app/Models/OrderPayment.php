<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderPayment extends Model
{
    protected $fillable = [
        'order_id',
        'amount',
        'paid_at',
        'recorded_by',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'paid_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function toApiArray(): array
    {
        $this->loadMissing('recorder:id,name');

        return [
            'id' => (string) $this->id,
            'amount' => round((float) $this->amount, 2),
            'paidAt' => $this->paid_at->toIso8601String(),
            'recordedById' => $this->recorded_by ? (string) $this->recorded_by : null,
            'recordedByName' => $this->recorder?->name,
            'note' => $this->note,
            'createdAt' => $this->created_at->toIso8601String(),
        ];
    }
}
