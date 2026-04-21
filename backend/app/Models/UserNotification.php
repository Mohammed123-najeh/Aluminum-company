<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserNotification extends Model
{
    public const TYPE_MESSAGE = 'message';

    public const TYPE_TASK_ASSIGNED = 'task_assigned';

    public const TYPE_TASK_STATUS = 'task_status';

    public const TYPE_WELCOME = 'welcome';

    public const TYPE_HR_LEAVE_PENDING = 'hr_leave_pending';

    public const TYPE_HR_LEAVE_DECIDED = 'hr_leave_decided';

    public const TYPE_HR_SALARY_PENDING = 'hr_salary_pending';

    public const TYPE_HR_SALARY_DECIDED = 'hr_salary_decided';

    public const TYPE_ADMIN_SALARY_PENDING = 'admin_salary_pending';

    public const TYPE_ADMIN_SUBMISSION_PENDING = 'admin_submission_pending';

    public const TYPE_ADMIN_SUBMISSION_DECIDED = 'admin_submission_decided';

    protected $table = 'user_notifications';

    protected $fillable = [
        'user_id',
        'type',
        'title',
        'body',
        'data',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'read_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function markRead(): void
    {
        if ($this->read_at === null) {
            $this->read_at = now();
            $this->save();
        }
    }

    /** @return array<string, mixed> */
    public function toApiArray(): array
    {
        return [
            'id' => (string) $this->id,
            'type' => $this->type,
            'title' => $this->title,
            'body' => $this->body,
            'data' => $this->data ?? [],
            'readAt' => $this->read_at?->toISOString(),
            'createdAt' => $this->created_at->toISOString(),
        ];
    }
}
