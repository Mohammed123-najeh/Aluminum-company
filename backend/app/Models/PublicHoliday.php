<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PublicHoliday extends Model
{
    protected $fillable = ['date', 'name_ar', 'name_en'];

    protected function casts(): array
    {
        return ['date' => 'date'];
    }

    public function toApiArray(): array
    {
        return [
            'id' => (string) $this->id,
            'date' => $this->date?->toDateString(),
            'nameAr' => $this->name_ar,
            'nameEn' => $this->name_en,
        ];
    }
}
