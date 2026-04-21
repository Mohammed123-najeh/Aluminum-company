<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalaryIncreaseRequest extends Model
{
    protected $table = 'salary_increase_requests';

    protected $fillable = [
        'user_id',
        'current_salary_snapshot',
        'requested_monthly_salary',
        'reason',
        'status',
        'decided_by',
        'decided_at',
        'decision_note',
        'approved_monthly_salary',
    ];

    protected function casts(): array
    {
        return [
            'current_salary_snapshot' => 'decimal:2',
            'requested_monthly_salary'=> 'decimal:2',
            'approved_monthly_salary' => 'decimal:2',
            'decided_at'              => 'datetime',
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
            'id'                    => (string) $this->id,
            'userId'                => (string) $this->user_id,
            'userName'              => $this->user?->name,
            'userEmail'             => $this->user?->email,
            'currentSalarySnapshot' => $this->current_salary_snapshot !== null ? (string) $this->current_salary_snapshot : null,
            'requestedMonthlySalary'=> (string) $this->requested_monthly_salary,
            'reason'                => $this->reason,
            'status'                => $this->status,
            'decidedById'           => $this->decided_by ? (string) $this->decided_by : null,
            'decidedByName'         => $this->decidedBy?->name,
            'decidedAt'             => $this->decided_at?->toISOString(),
            'decisionNote'          => $this->decision_note,
            'approvedMonthlySalary' => $this->approved_monthly_salary !== null ? (string) $this->approved_monthly_salary : null,
            'createdAt'             => $this->created_at->toISOString(),
        ];
    }
}
