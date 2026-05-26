<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PayrollRun extends Model
{
    public const STATUS_DRAFT = 'draft';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_PAID = 'paid';

    protected $fillable = [
        'year', 'month', 'status', 'total_gross', 'total_deductions', 'total_net',
        'employee_count', 'created_by', 'approved_by', 'approved_at', 'paid_at', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'month' => 'integer',
            'total_gross' => 'decimal:2',
            'total_deductions' => 'decimal:2',
            'total_net' => 'decimal:2',
            'employee_count' => 'integer',
            'approved_at' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    public function payslips(): HasMany
    {
        return $this->hasMany(Payslip::class, 'run_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isLocked(): bool
    {
        return in_array($this->status, [self::STATUS_APPROVED, self::STATUS_PAID], true);
    }

    public function toApiArray(): array
    {
        return [
            'id' => (string) $this->id,
            'year' => (int) $this->year,
            'month' => (int) $this->month,
            'status' => $this->status,
            'totalGross' => (string) $this->total_gross,
            'totalDeductions' => (string) $this->total_deductions,
            'totalNet' => (string) $this->total_net,
            'employeeCount' => (int) $this->employee_count,
            'approvedAt' => $this->approved_at?->toISOString(),
            'paidAt' => $this->paid_at?->toISOString(),
            'createdAt' => $this->created_at?->toISOString(),
            'notes' => $this->notes,
        ];
    }
}
