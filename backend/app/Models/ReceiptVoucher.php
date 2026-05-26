<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ReceiptVoucher extends Model
{
    protected $fillable = [
        'number', 'date', 'client_id', 'payer_name', 'amount', 'method',
        'reference_no', 'notes', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'amount' => 'decimal:2',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(ReceiptVoucherAllocation::class, 'voucher_id');
    }

    public function toApiArray(): array
    {
        $this->loadMissing('client:id,name', 'allocations');

        return [
            'id' => (string) $this->id,
            'number' => $this->number,
            'date' => $this->date?->toDateString(),
            'clientId' => $this->client_id ? (string) $this->client_id : null,
            'clientName' => $this->client?->name ?? $this->payer_name,
            'amount' => (string) $this->amount,
            'method' => $this->method,
            'referenceNo' => $this->reference_no,
            'notes' => $this->notes,
            'allocations' => $this->allocations->map(fn ($a) => [
                'invoiceId' => (string) $a->invoice_id,
                'amount' => (string) $a->amount,
            ])->all(),
            'createdAt' => $this->created_at?->toISOString(),
        ];
    }
}
