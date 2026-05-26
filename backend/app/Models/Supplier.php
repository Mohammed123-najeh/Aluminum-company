<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Supplier extends Model
{
    protected $fillable = [
        'name', 'phone', 'email', 'address', 'vat_no', 'notes', 'archived',
    ];

    protected function casts(): array
    {
        return ['archived' => 'boolean'];
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(SupplierInvoice::class);
    }

    public function toApiArray(): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'phone' => $this->phone,
            'email' => $this->email,
            'address' => $this->address,
            'vatNo' => $this->vat_no,
            'notes' => $this->notes,
            'archived' => (bool) $this->archived,
            'createdAt' => $this->created_at?->toISOString(),
        ];
    }
}
