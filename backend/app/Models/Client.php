<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Client extends Model
{
    protected $fillable = [
        'supervisor_id',
        'accountant_created_by',
        'source',
        'name',
        'phone',
        'email',
        'notes',
    ];

    public function supervisor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supervisor_id');
    }

    public function accountantCreator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'accountant_created_by');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }
}
