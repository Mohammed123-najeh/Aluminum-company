<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalaryIncrement extends Model
{
    public const TYPE_ANNUAL = 'annual';
    public const TYPE_PROMOTION = 'promotion';
    public const TYPE_BONUS = 'bonus';
    public const TYPE_ADJUSTMENT = 'adjustment';

    protected $fillable = [
        'user_id', 'type', 'old_salary', 'new_salary', 'amount', 'percentage',
        'effective_date', 'reason', 'created_by', 'applied', 'applied_at',
    ];

    protected function casts(): array
    {
        return [
            'old_salary' => 'decimal:2',
            'new_salary' => 'decimal:2',
            'amount' => 'decimal:2',
            'percentage' => 'decimal:3',
            'effective_date' => 'date',
            'applied' => 'boolean',
            'applied_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function toApiArray(): array
    {
        $this->loadMissing('user:id,name,department', 'createdBy:id,name');

        return [
            'id' => (string) $this->id,
            'userId' => (string) $this->user_id,
            'userName' => $this->user?->name,
            'department' => $this->user?->department,
            'type' => $this->type,
            'oldSalary' => (string) $this->old_salary,
            'newSalary' => (string) $this->new_salary,
            'amount' => (string) $this->amount,
            'percentage' => $this->percentage !== null ? (string) $this->percentage : null,
            'effectiveDate' => $this->effective_date?->toDateString(),
            'reason' => $this->reason,
            'createdById' => $this->created_by ? (string) $this->created_by : null,
            'createdByName' => $this->createdBy?->name,
            'applied' => (bool) $this->applied,
            'appliedAt' => $this->applied_at?->toISOString(),
            'createdAt' => $this->created_at?->toISOString(),
        ];
    }
}
