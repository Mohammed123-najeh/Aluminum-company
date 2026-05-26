<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WorkScheduleSetting extends Model
{
    protected $fillable = [
        'work_start', 'work_end', 'grace_minutes', 'work_days',
        'late_deduction_per_minute', 'absence_deduction_formula',
        'vat_rate', 'employee_insurance_pct', 'employer_insurance_pct',
    ];

    protected function casts(): array
    {
        return [
            'grace_minutes' => 'integer',
            'work_days' => 'array',
            'late_deduction_per_minute' => 'decimal:4',
            'vat_rate' => 'decimal:2',
            'employee_insurance_pct' => 'decimal:2',
            'employer_insurance_pct' => 'decimal:2',
        ];
    }

    public static function current(): self
    {
        return self::firstOrCreate([], [
            'work_start' => '08:00:00',
            'work_end' => '17:00:00',
            'grace_minutes' => 15,
            'work_days' => ['sun', 'mon', 'tue', 'wed', 'thu'],
            'late_deduction_per_minute' => 0,
            'absence_deduction_formula' => 'daily',
            'vat_rate' => 15,
            'employee_insurance_pct' => 0,
            'employer_insurance_pct' => 0,
        ]);
    }

    public function toApiArray(): array
    {
        return [
            'id' => (string) $this->id,
            'workStart' => substr((string) $this->work_start, 0, 5),
            'workEnd' => substr((string) $this->work_end, 0, 5),
            'graceMinutes' => (int) $this->grace_minutes,
            'workDays' => $this->work_days ?? [],
            'lateDeductionPerMinute' => (string) $this->late_deduction_per_minute,
            'absenceDeductionFormula' => $this->absence_deduction_formula,
            'vatRate' => (string) $this->vat_rate,
            'employeeInsurancePct' => (string) $this->employee_insurance_pct,
            'employerInsurancePct' => (string) $this->employer_insurance_pct,
        ];
    }
}
