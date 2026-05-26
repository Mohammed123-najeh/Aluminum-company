<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupplierInvoice extends Model
{
    public const STATUS_PENDING = 'pending_approval';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_PAID = 'paid';
    public const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'number', 'date', 'due_date', 'supplier_id', 'subtotal', 'vat_rate',
        'vat_amount', 'total', 'paid', 'balance', 'status', 'notes',
        'attachment_path', 'created_by', 'approved_by', 'approved_at', 'rejection_reason',
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
            'approved_at' => 'datetime',
        ];
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(SupplierInvoiceItem::class, 'invoice_id');
    }

    public function toApiArray(): array
    {
        $this->loadMissing('supplier:id,name', 'items');

        return [
            'id' => (string) $this->id,
            'number' => $this->number,
            'date' => $this->date?->toDateString(),
            'dueDate' => $this->due_date?->toDateString(),
            'supplierId' => (string) $this->supplier_id,
            'supplierName' => $this->supplier?->name,
            'subtotal' => (string) $this->subtotal,
            'vatRate' => (string) $this->vat_rate,
            'vatAmount' => (string) $this->vat_amount,
            'total' => (string) $this->total,
            'paid' => (string) $this->paid,
            'balance' => (string) $this->balance,
            'status' => $this->status,
            'notes' => $this->notes,
            'attachmentPath' => $this->attachment_path,
            'rejectionReason' => $this->rejection_reason,
            'items' => $this->items->map(fn ($it) => $it->toApiArray())->all(),
            'createdAt' => $this->created_at?->toISOString(),
        ];
    }
}
