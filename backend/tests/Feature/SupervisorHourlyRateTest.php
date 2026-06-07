<?php

namespace Tests\Feature;

use App\Models\AttendanceLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SupervisorHourlyRateTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_update_and_use_supervisor_hourly_rate_in_payroll_summary(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);

        Sanctum::actingAs($admin);

        $createResponse = $this->postJson('/api/users', [
            'name' => 'Supervisor Pay Test',
            'email' => 'supervisor-pay-test@example.com',
            'password' => 'password123',
            'role' => 'supervisor',
            'main_job' => 'Production Supervisor',
            'hourly_rate' => 37.50,
        ]);

        $createResponse
            ->assertCreated()
            ->assertJsonPath('role', 'supervisor')
            ->assertJsonPath('mainJob', 'Production Supervisor')
            ->assertJsonPath('hourlyRate', '37.50');

        $supervisorId = $createResponse->json('id');

        $updateResponse = $this->putJson("/api/users/{$supervisorId}", [
            'hourly_rate' => 42.25,
        ]);

        $updateResponse
            ->assertOk()
            ->assertJsonPath('hourlyRate', '42.25');

        AttendanceLog::create([
            'user_id' => (int) $supervisorId,
            'clock_in_at' => '2026-06-07 08:00:00',
            'clock_out_at' => '2026-06-07 10:00:00',
            'minutes_worked' => 120,
        ]);

        $summary = $this->getJson('/api/attendance/summary?from=2026-06-07&to=2026-06-07')
            ->assertOk()
            ->json('rows');

        $row = collect($summary)->firstWhere('userId', (string) $supervisorId);

        $this->assertNotNull($row);
        $this->assertSame('supervisor', $row['role']);
        $this->assertSame(42.25, $row['hourlyRate']);
        $this->assertSame(2, $row['totalHours']);
        $this->assertSame(84.5, $row['computedEarnings']);
    }
}
