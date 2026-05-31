<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceLog extends Model
{
    public const STATUS_PRESENT = 'present';
    public const STATUS_LATE = 'late';
    public const STATUS_ABSENT = 'absent';
    public const STATUS_LEAVE = 'leave';
    public const STATUS_MISSION = 'mission';
    public const STATUS_HOLIDAY = 'holiday';

    protected $fillable = [
        'user_id',
        'clock_in_at',
        'clock_out_at',
        'last_heartbeat_at',
        'minutes_worked',
        'ip_address',
        'user_agent',
        'status',
        'late_minutes',
        'justified',
        'excuse_document_path',
        'justification_reason',
        'decided_by',
        'decided_at',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'clock_in_at' => 'datetime',
            'clock_out_at' => 'datetime',
            'last_heartbeat_at' => 'datetime',
            'minutes_worked' => 'integer',
            'late_minutes' => 'integer',
            'justified' => 'boolean',
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
        return [
            'id' => (string) $this->id,
            'userId' => (string) $this->user_id,
            'clockInAt' => $this->clock_in_at?->toIso8601String(),
            'clockOutAt' => $this->clock_out_at?->toIso8601String(),
            'minutesWorked' => $this->minutes_worked,
            'hoursWorked' => $this->minutes_worked !== null ? round($this->minutes_worked / 60, 2) : null,
            'ipAddress' => $this->ip_address,
            'status' => $this->status,
            'lateMinutes' => (int) ($this->late_minutes ?? 0),
            'justified' => (bool) $this->justified,
            'excuseDocumentPath' => $this->excuse_document_path,
            'justificationReason' => $this->justification_reason,
            'decidedById' => $this->decided_by ? (string) $this->decided_by : null,
            'decidedAt' => $this->decided_at?->toISOString(),
            'notes' => $this->notes,
        ];
    }
}
