<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeaveRequest extends Model
{
    protected $fillable = [
        'user_id',
        'supervisor_id',
        'workflow_step',
        'type',
        'start_date',
        'end_date',
        'days_count',
        'reason',
        'status',
        'decided_by',
        'decided_at',
        'decision_note',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date'   => 'date',
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
            'id'           => (string) $this->id,
            'userId'       => (string) $this->user_id,
            'userName'     => $this->user?->name,
            'userEmail'    => $this->user?->email,
            'supervisorId' => $this->supervisor_id ? (string) $this->supervisor_id : null,
            'workflowStep' => $this->workflow_step,
            'type'         => $this->type,
            'startDate'    => $this->start_date->format('Y-m-d'),
            'endDate'      => $this->end_date->format('Y-m-d'),
            'daysCount'    => $this->days_count,
            'reason'       => $this->reason,
            'status'       => $this->status,
            'decidedById'  => $this->decided_by ? (string) $this->decided_by : null,
            'decidedByName'=> $this->decidedBy?->name,
            'decidedAt'    => $this->decided_at?->toISOString(),
            'decisionNote' => $this->decision_note,
            'createdAt'    => $this->created_at->toISOString(),
        ];
    }
}
