<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('attendance_logs', function (Blueprint $table) {
            $table->string('status', 20)->default('present')->after('minutes_worked');
            $table->unsignedSmallInteger('late_minutes')->default(0)->after('status');
            $table->boolean('justified')->default(false)->after('late_minutes');
            $table->string('excuse_document_path')->nullable()->after('justified');
            $table->text('justification_reason')->nullable()->after('excuse_document_path');
            $table->foreignId('decided_by')->nullable()->after('justification_reason')->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable()->after('decided_by');
            $table->text('notes')->nullable()->after('decided_at');
        });
    }

    public function down(): void
    {
        Schema::table('attendance_logs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('decided_by');
            $table->dropColumn(['status', 'late_minutes', 'justified', 'excuse_document_path', 'justification_reason', 'decided_at', 'notes']);
        });
    }
};
