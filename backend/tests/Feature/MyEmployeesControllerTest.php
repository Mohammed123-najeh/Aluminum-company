<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MyEmployeesControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_supervisor_sees_all_direct_employees_including_typed_departments(): void
    {
        $supervisor = User::factory()->create([
            'role' => 'supervisor',
            'status' => 'active',
        ]);
        $accountant = User::factory()->create([
            'role' => 'employee',
            'employee_type' => 'accountant',
            'supervisor_id' => $supervisor->id,
            'status' => 'active',
        ]);
        $sales = User::factory()->create([
            'role' => 'employee',
            'employee_type' => 'sales',
            'supervisor_id' => $supervisor->id,
            'status' => 'active',
        ]);
        $plain = User::factory()->create([
            'role' => 'employee',
            'employee_type' => null,
            'supervisor_id' => $supervisor->id,
            'status' => 'active',
        ]);

        Sanctum::actingAs($supervisor);

        $ids = collect($this->getJson('/api/my-employees')->assertOk()->json())
            ->pluck('id')
            ->all();

        $this->assertContains((string) $accountant->id, $ids);
        $this->assertContains((string) $sales->id, $ids);
        $this->assertContains((string) $plain->id, $ids);
    }
}
