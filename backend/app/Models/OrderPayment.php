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
        'method',
        'cheque_bank',
        'cheque_number',
        'cheque_holder',
        'cheque_amount',
        'cheque_issue_date',
        'cheque_due_date',
        'cheque_status',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'cheque_amount' => 'decimal:2',
            'paid_at' => 'datetime',
            'cheque_issue_date' => 'date',
            'cheque_due_date' => 'date',
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
            'method' => $this->method,
            'cheque' => $this->method === 'check' && $this->cheque_number ? [
                'bank' => $this->cheque_bank,
                'number' => $this->cheque_number,
                'holder' => $this->cheque_holder,
                'amount' => $this->cheque_amount !== null ? round((float) $this->cheque_amount, 2) : null,
                'issueDate' => $this->cheque_issue_date?->toDateString(),
                'dueDate' => $this->cheque_due_date?->toDateString(),
                'status' => $this->cheque_status,
            ] : null,
            'createdAt' => $this->created_at->toIso8601String(),
        ];
    }
}
