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
        'base_salary',
        'annual_leave_balance',
        'supervisor_id',
        'status',
        'last_login_at',
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
            'base_salary'           => 'decimal:2',
            'annual_leave_balance'  => 'decimal:1',
        ];
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
            'baseSalary'           => $this->base_salary !== null ? (string) $this->base_salary : null,
            'annualLeaveBalance'   => $this->annual_leave_balance !== null ? (string) $this->annual_leave_balance : null,
            'supervisorId'         => $this->supervisor_id ? (string) $this->supervisor_id : null,
            'status'               => $this->status,
            'lastLogin'            => $this->last_login_at?->toISOString(),
            'createdAt'            => $this->created_at->toISOString(),
        ];
    }
}
