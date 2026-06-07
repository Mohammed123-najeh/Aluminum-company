<?php

namespace Tests\Feature;

use App\Models\Color;
use App\Models\FinanceTransaction;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderPayment;
use App\Models\ProductCategory;
use App\Models\Profile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrderCancellationTest extends TestCase
{
    use RefreshDatabase;

    public function test_supervisor_can_partially_cancel_order_items_and_refund_overpaid_balance(): void
    {
        [$supervisor, $profile, $color] = $this->catalogContext();
        Sanctum::actingAs($supervisor);

        $order = Order::create([
            'creator_id' => $supervisor->id,
            'supervisor_id' => $supervisor->id,
            'status' => 'completed',
            'total_amount' => 300,
            'amount_paid' => 250,
            'currency' => 'ILS',
            'receipt_number' => 'RCP-TEST-1',
        ]);
        $cancelledItem = OrderItem::create([
            'order_id' => $order->id,
            'profile_id' => $profile->id,
            'color_code' => $color->color_code,
            'quantity' => 1,
            'unit_price' => 100,
            'line_total' => 100,
        ]);
        OrderItem::create([
            'order_id' => $order->id,
            'profile_id' => $profile->id,
            'color_code' => $color->color_code,
            'quantity' => 2,
            'unit_price' => 100,
            'line_total' => 200,
        ]);
        OrderPayment::create([
            'order_id' => $order->id,
            'amount' => 250,
            'paid_at' => now(),
            'recorded_by' => $supervisor->id,
        ]);

        $this->postJson("/api/orders/{$order->id}/cancel", [
            'type' => 'partial',
            'item_ids' => [(string) $cancelledItem->id],
            'reason' => 'Customer removed one item',
        ])->assertOk()
            ->assertJsonPath('status', 'completed')
            ->assertJsonPath('cancellationType', 'partial')
            ->assertJsonPath('totalAmount', 200)
            ->assertJsonPath('amountPaid', 200)
            ->assertJsonPath('balanceDue', 0)
            ->assertJsonPath('cancelledAmount', 100)
            ->assertJsonPath('refundedAmount', 50);

        $this->assertDatabaseHas('order_items', [
            'id' => $cancelledItem->id,
            'is_cancelled' => true,
            'cancelled_amount' => 100,
        ]);
        $this->assertDatabaseHas('order_payments', [
            'order_id' => $order->id,
            'amount' => -50,
        ]);
        $this->assertDatabaseHas('finance_transactions', [
            'ref_type' => 'order_cancellation',
            'ref_id' => $order->id,
            'type' => FinanceTransaction::TYPE_PAYMENT,
            'amount' => 50,
        ]);
    }

    public function test_supervisor_can_fully_cancel_order_and_clear_financial_balance(): void
    {
        [$supervisor, $profile, $color] = $this->catalogContext();
        Sanctum::actingAs($supervisor);

        $order = Order::create([
            'creator_id' => $supervisor->id,
            'supervisor_id' => $supervisor->id,
            'status' => 'completed',
            'total_amount' => 150,
            'amount_paid' => 80,
            'currency' => 'ILS',
            'receipt_number' => 'RCP-TEST-2',
        ]);
        OrderItem::create([
            'order_id' => $order->id,
            'profile_id' => $profile->id,
            'color_code' => $color->color_code,
            'quantity' => 3,
            'unit_price' => 50,
            'line_total' => 150,
        ]);

        $this->postJson("/api/orders/{$order->id}/cancel", [
            'type' => 'full',
            'reason' => 'Customer cancelled',
        ])->assertOk()
            ->assertJsonPath('status', 'cancelled')
            ->assertJsonPath('cancellationType', 'full')
            ->assertJsonPath('totalAmount', 0)
            ->assertJsonPath('amountPaid', 0)
            ->assertJsonPath('balanceDue', 0)
            ->assertJsonPath('refundedAmount', 80);

        $this->assertDatabaseHas('order_payments', [
            'order_id' => $order->id,
            'amount' => -80,
        ]);
    }

    private function catalogContext(): array
    {
        $supervisor = User::factory()->create([
            'role' => 'supervisor',
            'status' => 'active',
        ]);
        ProductCategory::create([
            'category_code' => 'TEST',
            'category_name' => 'Test',
        ]);
        $profile = Profile::create([
            'profile_id' => 'TEST-PROFILE',
            'category_code' => 'TEST',
            'name' => 'Test profile',
        ]);
        $color = Color::create([
            'color_code' => 'WHITE',
            'name' => 'White',
        ]);

        return [$supervisor, $profile, $color];
    }
}
