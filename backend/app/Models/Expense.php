<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Expense extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_PAID = 'paid';

    protected $fillable = [
        'category_id', 'description', 'amount', 'date', 'supplier_name', 'supplier_id',
        'payment_method', 'reference_no', 'attachment_path', 'submitted_by', 'status',
        'approved_by', 'approved_at', 'rejection_reason',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'date' => 'date',
            'approved_at' => 'datetime',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ExpenseCategory::class, 'category_id');
    }

    public function submittedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function toApiArray(): array
    {
        $this->loadMissing('category', 'submittedBy:id,name', 'approvedBy:id,name');

        return [
            'id' => (string) $this->id,
            'categoryId' => (string) $this->category_id,
            'categoryNameAr' => $this->category?->name_ar,
            'categoryNameEn' => $this->category?->name_en,
            'description' => $this->description,
            'amount' => (string) $this->amount,
            'date' => $this->date?->toDateString(),
            'supplierName' => $this->supplier_name,
            'supplierId' => $this->supplier_id ? (string) $this->supplier_id : null,
            'paymentMethod' => $this->payment_method,
            'referenceNo' => $this->reference_no,
            'attachmentPath' => $this->attachment_path,
            'submittedById' => $this->submitted_by ? (string) $this->submitted_by : null,
            'submittedByName' => $this->submittedBy?->name,
            'status' => $this->status,
            'approvedById' => $this->approved_by ? (string) $this->approved_by : null,
            'approvedByName' => $this->approvedBy?->name,
            'approvedAt' => $this->approved_at?->toISOString(),
            'rejectionReason' => $this->rejection_reason,
            'createdAt' => $this->created_at?->toISOString(),
        ];
    }
}
