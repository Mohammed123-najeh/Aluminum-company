<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('password_reset_codes', function (Blueprint $table) {
            $table->id();
            $table->string('email', 255);
            $table->string('code_hash', 255);
            $table->timestamp('expires_at');
            $table->timestamp('consumed_at')->nullable();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->index('email');
            $table->index(['email', 'consumed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('password_reset_codes');
    }
};
