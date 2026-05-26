<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeDocument extends Model
{
    public const TYPE_CONTRACT = 'contract';
    public const TYPE_ID = 'id';
    public const TYPE_PASSPORT = 'passport';
    public const TYPE_CERTIFICATE = 'certificate';
    public const TYPE_OTHER = 'other';

    protected $fillable = ['user_id', 'type', 'label', 'file_path', 'uploaded_by'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function toApiArray(): array
    {
        $this->loadMissing('uploadedBy:id,name');

        return [
            'id' => (string) $this->id,
            'userId' => (string) $this->user_id,
            'type' => $this->type,
            'label' => $this->label,
            'filePath' => $this->file_path,
            'uploadedById' => $this->uploaded_by ? (string) $this->uploaded_by : null,
            'uploadedByName' => $this->uploadedBy?->name,
            'uploadedAt' => $this->created_at?->toISOString(),
        ];
    }
}
