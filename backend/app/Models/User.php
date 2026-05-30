<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'employee_type',
        'main_job',
        'hourly_rate',
        'annual_leave_balance',
        'supervisor_id',
        'status',
        'last_login_at',
        'employee_number',
        'allowances',
        'national_id',
        'nationality',
        'birth_date',
        'gender',
        'marital_status',
        'children_count',
        'address',
        'phone',
        'photo_path',
        'hire_date',
        'contract_type',
        'contract_duration',
        'bank_account',
        'department',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at'     => 'datetime',
            'last_login_at'         => 'datetime',
            'password'              => 'hashed',
            'hourly_rate'           => 'decimal:2',
            'annual_leave_balance'  => 'decimal:1',
            'allowances'            => 'array',
            'birth_date'            => 'date',
            'hire_date'             => 'date',
            'children_count'        => 'integer',
        ];
    }

    public function documents()
    {
        return $this->hasMany(EmployeeDocument::class);
    }

    public function payslips()
    {
        return $this->hasMany(Payslip::class);
    }

    public function salaryIncrements()
    {
        return $this->hasMany(SalaryIncrement::class);
    }

    public function attendanceLogs()
    {
        return $this->hasMany(AttendanceLog::class);
    }

    public function supervisor()
    {
        return $this->belongsTo(User::class, 'supervisor_id');
    }

    public function subordinates()
    {
        return $this->hasMany(User::class, 'supervisor_id');
    }

    public function assignedTasks()
    {
        return $this->belongsToMany(Task::class, 'task_assignees', 'user_id', 'task_id')
            ->withTimestamps();
    }

    public function leaveRequests()
    {
        return $this->hasMany(LeaveRequest::class);
    }

    public function salaryIncreaseRequests()
    {
        return $this->hasMany(SalaryIncreaseRequest::class);
    }

    public function isHrStaff(): bool
    {
        return $this->role === 'employee' && $this->employee_type === 'hr';
    }

    public function isAccountant(): bool
    {
        return $this->role === 'employee' && $this->employee_type === 'accountant';
    }

    public static function hrRecipients(): \Illuminate\Database\Eloquent\Builder
    {
        return static::query()
            ->where('role', 'employee')
            ->where('employee_type', 'hr')
            ->where('status', 'active');
    }

    public static function adminRecipients(): \Illuminate\Database\Eloquent\Builder
    {
        return static::query()
            ->where('role', 'admin')
            ->where('status', 'active');
    }

    public function toApiArray(): array
    {
        return [
            'id'                   => (string) $this->id,
            'name'                 => $this->name,
            'email'                => $this->email,
            'role'                 => $this->role,
            'employeeType'         => $this->employee_type,
            'mainJob'              => $this->main_job,
            'hourlyRate'           => $this->hourly_rate !== null ? (string) $this->hourly_rate : null,
            'annualLeaveBalance'   => $this->annual_leave_balance !== null ? (string) $this->annual_leave_balance : null,
            'supervisorId'         => $this->supervisor_id ? (string) $this->supervisor_id : null,
            'status'               => $this->status,
            'lastLogin'            => $this->last_login_at?->toISOString(),
            'createdAt'            => $this->created_at->toISOString(),
            'employeeNumber'       => $this->employee_number,
            'allowances'           => $this->allowances ?? [],
            'nationalId'           => $this->national_id,
            'nationality'          => $this->nationality,
            'birthDate'            => $this->birth_date?->toDateString(),
            'gender'               => $this->gender,
            'maritalStatus'        => $this->marital_status,
            'childrenCount'        => $this->children_count,
            'address'              => $this->address,
            'phone'                => $this->phone,
            'photoPath'            => $this->photo_path,
            'hireDate'             => $this->hire_date?->toDateString(),
            'contractType'         => $this->contract_type,
            'contractDuration'     => $this->contract_duration,
            'bankAccount'          => $this->bank_account,
            'department'           => $this->department,
        ];
    }
}
