<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceLog extends Model
{
    protected $fillable = [
        'user_id',
        'clock_in_at',
        'clock_out_at',
        'minutes_worked',
        'ip_address',
        'user_agent',
    ];

    protected function casts(): array
    {
        return [
            'clock_in_at' => 'datetime',
            'clock_out_at' => 'datetime',
            'minutes_worked' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
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
        ];
    }
}
