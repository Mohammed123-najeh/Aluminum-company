<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('total_amount', 14, 2)->nullable()->after('customer_reference');
            $table->string('currency', 10)->default('SAR')->after('total_amount');
            $table->string('receipt_number', 40)->nullable()->unique()->after('currency');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->decimal('unit_price_per_m', 14, 4)->nullable()->after('quantity_m');
            $table->decimal('line_total', 14, 2)->nullable()->after('unit_price_per_m');
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn(['unit_price_per_m', 'line_total']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['total_amount', 'currency', 'receipt_number']);
        });
    }
};
