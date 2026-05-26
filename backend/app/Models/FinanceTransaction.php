<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FinanceTransaction extends Model
{
    public const TYPE_REVENUE = 'revenue';
    public const TYPE_PAYMENT = 'payment';

    protected $fillable = [
        'type', 'source', 'ref_type', 'ref_id', 'party_type', 'party_id', 'party_name',
        'amount', 'method', 'reference_no', 'date', 'notes', 'status', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'date' => 'date',
        ];
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function toApiArray(): array
    {
        return [
            'id' => (string) $this->id,
            'type' => $this->type,
            'source' => $this->source,
            'refType' => $this->ref_type,
            'refId' => $this->ref_id ? (string) $this->ref_id : null,
            'partyType' => $this->party_type,
            'partyId' => $this->party_id ? (string) $this->party_id : null,
            'partyName' => $this->party_name,
            'amount' => (string) $this->amount,
            'method' => $this->method,
            'referenceNo' => $this->reference_no,
            'date' => $this->date?->toDateString(),
            'notes' => $this->notes,
            'status' => $this->status,
            'createdById' => $this->created_by ? (string) $this->created_by : null,
            'createdAt' => $this->created_at?->toISOString(),
        ];
    }
}
