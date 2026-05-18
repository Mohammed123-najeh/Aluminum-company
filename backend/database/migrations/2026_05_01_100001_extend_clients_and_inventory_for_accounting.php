<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->foreignId('accountant_created_by')->nullable()->after('supervisor_id')->constrained('users')->nullOnDelete();
            $table->string('source', 30)->default('supervisor')->after('accountant_created_by');
        });

        Schema::table('clients', function (Blueprint $table) {
            $table->foreignId('supervisor_id')->nullable()->change();
        });

        Schema::table('inventory', function (Blueprint $table) {
            $table->decimal('unit_price', 14, 2)->nullable()->after('quantity');
        });
    }

    public function down(): void
    {
        Schema::table('inventory', function (Blueprint $table) {
            $table->dropColumn('unit_price');
        });

        Schema::table('clients', function (Blueprint $table) {
            $table->dropForeign(['accountant_created_by']);
            $table->dropColumn(['accountant_created_by', 'source']);
        });
    }
};
