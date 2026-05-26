<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CustomerInvoice extends Model
{
    public const STATUS_DRAFT = 'draft';
    public const STATUS_SENT = 'sent';
    public const STATUS_PARTIAL = 'partial';
    public const STATUS_PAID = 'paid';
    public const STATUS_OVERDUE = 'overdue';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'number', 'date', 'due_date', 'client_id', 'client_name_snapshot', 'order_id',
        'subtotal', 'vat_rate', 'vat_amount', 'total', 'paid', 'balance', 'status',
        'notes', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'due_date' => 'date',
            'subtotal' => 'decimal:2',
            'vat_rate' => 'decimal:2',
            'vat_amount' => 'decimal:2',
            'total' => 'decimal:2',
            'paid' => 'decimal:2',
            'balance' => 'decimal:2',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(CustomerInvoiceItem::class, 'invoice_id');
    }

    public function toApiArray(): array
    {
        $this->loadMissing('client:id,name', 'items');

        return [
            'id' => (string) $this->id,
            'number' => $this->number,
            'date' => $this->date?->toDateString(),
            'dueDate' => $this->due_date?->toDateString(),
            'clientId' => $this->client_id ? (string) $this->client_id : null,
            'clientName' => $this->client?->name ?? $this->client_name_snapshot,
            'orderId' => $this->order_id ? (string) $this->order_id : null,
            'subtotal' => (string) $this->subtotal,
            'vatRate' => (string) $this->vat_rate,
            'vatAmount' => (string) $this->vat_amount,
            'total' => (string) $this->total,
            'paid' => (string) $this->paid,
            'balance' => (string) $this->balance,
            'status' => $this->status,
            'notes' => $this->notes,
            'items' => $this->items->map(fn ($it) => $it->toApiArray())->all(),
            'createdAt' => $this->created_at?->toISOString(),
        ];
    }
}
