<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('profiles', function (Blueprint $table) {
            $table->id();
            $table->string('profile_id', 30)->unique();
            $table->string('category_code', 20);
            $table->string('name');
            $table->decimal('thickness_mm', 6, 2)->nullable();
            $table->decimal('weight_kg_per_m', 8, 3)->nullable();
            $table->string('usage')->nullable();
            $table->timestamps();

            $table->foreign('category_code')->references('category_code')->on('product_categories')->cascadeOnUpdate()->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('profiles');
    }
};
