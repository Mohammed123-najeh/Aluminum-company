<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AdminSubmission extends Model
{
    public const TYPE_FINANCE_REPORT = 'finance_report';

    public const TYPE_SUPERVISOR_NOTE = 'supervisor_note';

    public const TYPE_HR_NOTE = 'hr_note';

    public const TYPE_GENERAL = 'general';

    protected $fillable = [
        'submitted_by_id',
        'type',
        'title',
        'body',
        'attachment_disk',
        'attachment_path',
        'metadata',
        'status',
        'decided_by_id',
        'decided_at',
        'decision_note',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'decided_at' => 'datetime',
        ];
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by_id');
    }

    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by_id');
    }

    /** @return array<string, mixed> */
    public function toApiArray(): array
    {
        $this->loadMissing('submitter:id,name,email', 'decidedBy:id,name');

        return [
            'id' => (string) $this->id,
            'type' => $this->type,
            'title' => $this->title,
            'body' => $this->body,
            'hasAttachment' => $this->attachment_path !== null && $this->attachment_path !== '',
            'metadata' => $this->metadata ?? [],
            'status' => $this->status,
            'submittedBy' => $this->submitter ? [
                'id' => (string) $this->submitter->id,
                'name' => $this->submitter->name,
                'email' => $this->submitter->email,
            ] : null,
            'decidedBy' => $this->decidedBy ? [
                'id' => (string) $this->decidedBy->id,
                'name' => $this->decidedBy->name,
            ] : null,
            'decidedAt' => $this->decided_at?->toIso8601String(),
            'decisionNote' => $this->decision_note,
            'createdAt' => $this->created_at->toIso8601String(),
        ];
    }
}
