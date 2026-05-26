<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerInvoiceItem extends Model
{
    protected $fillable = ['invoice_id', 'description', 'quantity', 'unit_price', 'line_total', 'ordering'];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:3',
            'unit_price' => 'decimal:2',
            'line_total' => 'decimal:2',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(CustomerInvoice::class, 'invoice_id');
    }

    public function toApiArray(): array
    {
        return [
            'id' => (string) $this->id,
            'description' => $this->description,
            'quantity' => (string) $this->quantity,
            'unitPrice' => (string) $this->unit_price,
            'lineTotal' => (string) $this->line_total,
            'ordering' => (int) $this->ordering,
        ];
    }
}
