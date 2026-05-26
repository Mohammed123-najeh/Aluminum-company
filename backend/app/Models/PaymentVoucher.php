<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PaymentVoucher extends Model
{
    public const PAYEE_SUPPLIER = 'supplier';
    public const PAYEE_EMPLOYEE = 'employee';
    public const PAYEE_OTHER = 'other';

    protected $fillable = [
        'number', 'date', 'payee_type', 'payee_id', 'payee_name', 'amount',
        'method', 'reference_no', 'purpose', 'notes', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'amount' => 'decimal:2',
        ];
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(PaymentVoucherAllocation::class, 'voucher_id');
    }

    public function payeeDisplayName(): ?string
    {
        if ($this->payee_name) {
            return $this->payee_name;
        }
        if ($this->payee_type === self::PAYEE_SUPPLIER && $this->payee_id) {
            return Supplier::find($this->payee_id)?->name;
        }
        if ($this->payee_type === self::PAYEE_EMPLOYEE && $this->payee_id) {
            return User::find($this->payee_id)?->name;
        }
        return null;
    }

    public function toApiArray(): array
    {
        $this->loadMissing('allocations');

        return [
            'id' => (string) $this->id,
            'number' => $this->number,
            'date' => $this->date?->toDateString(),
            'payeeType' => $this->payee_type,
            'payeeId' => $this->payee_id ? (string) $this->payee_id : null,
            'payeeName' => $this->payeeDisplayName(),
            'amount' => (string) $this->amount,
            'method' => $this->method,
            'referenceNo' => $this->reference_no,
            'purpose' => $this->purpose,
            'notes' => $this->notes,
            'allocations' => $this->allocations->map(fn ($a) => [
                'invoiceId' => (string) $a->invoice_id,
                'amount' => (string) $a->amount,
            ])->all(),
            'createdAt' => $this->created_at?->toISOString(),
        ];
    }
}
