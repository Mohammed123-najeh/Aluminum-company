<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payslip extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_PAID = 'paid';

    protected $fillable = [
        'run_id', 'user_id', 'earned_amount', 'allowances', 'deductions',
        'gross', 'total_deductions', 'net', 'status', 'paid_at', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'earned_amount' => 'decimal:2',
            'gross' => 'decimal:2',
            'total_deductions' => 'decimal:2',
            'net' => 'decimal:2',
            'allowances' => 'array',
            'deductions' => 'array',
            'paid_at' => 'datetime',
        ];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class, 'run_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function toApiArray(): array
    {
        $this->loadMissing('user:id,name,email,department,main_job,hourly_rate');

        return [
            'id' => (string) $this->id,
            'runId' => (string) $this->run_id,
            'userId' => (string) $this->user_id,
            'userName' => $this->user?->name,
            'department' => $this->user?->department,
            'mainJob' => $this->user?->main_job,
            'hourlyRate' => $this->user?->hourly_rate !== null ? (string) $this->user->hourly_rate : null,
            'earnedAmount' => (string) $this->earned_amount,
            'allowances' => $this->allowances ?? [],
            'deductions' => $this->deductions ?? [],
            'gross' => (string) $this->gross,
            'totalDeductions' => (string) $this->total_deductions,
            'net' => (string) $this->net,
            'status' => $this->status,
            'paidAt' => $this->paid_at?->toISOString(),
            'notes' => $this->notes,
        ];
    }
}
