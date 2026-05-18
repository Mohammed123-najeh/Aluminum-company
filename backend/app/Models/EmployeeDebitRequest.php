<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeDebitRequest extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'user_id',
        'amount',
        'reason',
        'status',
        'decided_by',
        'decided_at',
        'decision_note',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'decided_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }

    public function toApiArray(): array
    {
        $this->loadMissing('user:id,name,email', 'decidedBy:id,name');

        return [
            'id' => (string) $this->id,
            'userId' => (string) $this->user_id,
            'userName' => $this->user?->name,
            'userEmail' => $this->user?->email,
            'amount' => (string) $this->amount,
            'reason' => $this->reason,
            'status' => $this->status,
            'decidedById' => $this->decided_by ? (string) $this->decided_by : null,
            'decidedByName' => $this->decidedBy?->name,
            'decidedAt' => $this->decided_at?->toISOString(),
            'decisionNote' => $this->decision_note,
            'createdAt' => $this->created_at->toISOString(),
        ];
    }
}
