<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory', function (Blueprint $table) {
            $table->id();
            $table->foreignId('profile_id')->constrained('profiles')->cascadeOnDelete();
            $table->string('color_code', 30);
            $table->decimal('quantity_m', 12, 3)->default(0);
            $table->timestamps();

            $table->foreign('color_code')->references('color_code')->on('colors')->cascadeOnUpdate()->cascadeOnDelete();
            $table->unique(['profile_id', 'color_code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory');
    }
};
