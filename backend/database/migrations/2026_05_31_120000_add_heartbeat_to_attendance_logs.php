<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('attendance_logs', function (Blueprint $table) {
            // Activity-based tracking writes the last heartbeat into the open session
            // so the stitcher can detect long idle gaps without re-checking history.
            $table->timestamp('last_heartbeat_at')->nullable()->after('clock_out_at');
        });
    }

    public function down(): void
    {
        Schema::table('attendance_logs', function (Blueprint $table) {
            $table->dropColumn('last_heartbeat_at');
        });
    }
};
