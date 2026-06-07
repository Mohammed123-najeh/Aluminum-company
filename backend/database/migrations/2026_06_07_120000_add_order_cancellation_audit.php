<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('cancellation_type', 20)->nullable()->after('receipt_number');
            $table->timestamp('cancelled_at')->nullable()->after('cancellation_type');
            $table->foreignId('cancelled_by')->nullable()->after('cancelled_at')->constrained('users')->nullOnDelete();
            $table->text('cancellation_reason')->nullable()->after('cancelled_by');
            $table->decimal('cancelled_amount', 14, 2)->default(0)->after('cancellation_reason');
            $table->decimal('refunded_amount', 14, 2)->default(0)->after('cancelled_amount');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->boolean('is_cancelled')->default(false)->after('line_total');
            $table->decimal('cancelled_amount', 14, 2)->default(0)->after('is_cancelled');
            $table->timestamp('cancelled_at')->nullable()->after('cancelled_amount');
            $table->foreignId('cancelled_by')->nullable()->after('cancelled_at')->constrained('users')->nullOnDelete();
            $table->text('cancellation_reason')->nullable()->after('cancelled_by');
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cancelled_by');
            $table->dropColumn(['is_cancelled', 'cancelled_amount', 'cancelled_at', 'cancellation_reason']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cancelled_by');
            $table->dropColumn([
                'cancellation_type',
                'cancelled_at',
                'cancellation_reason',
                'cancelled_amount',
                'refunded_amount',
            ]);
        });
    }
};
