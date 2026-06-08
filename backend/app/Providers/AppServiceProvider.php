<?php

namespace App\Providers;

use App\Models\CustomerInvoice;
use App\Models\EmployeeDebitRequest;
use App\Models\Expense;
use App\Models\FinanceTransaction;
use App\Models\Order;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Cached dashboard/analytics payloads (see FinanceCenterController@dashboard and
        // AdminAnalyticsController@index) are busted whenever a model feeding their figures
        // changes — from ANY code path (controller, job, seeder) — so a freshly recorded
        // payment/expense/order shows at once instead of waiting out the TTL.
        //
        // The HR dashboard is deliberately NOT busted here: it's driven by AttendanceLog,
        // which heartbeats write every ~30s, so it relies on its short TTL instead.
        $registerBust = static function (array $models, array $keys): void {
            $bust = static function () use ($keys) {
                foreach ($keys as $key) {
                    Cache::forget($key);
                }
            };
            foreach ($models as $model) {
                $model::saved($bust);
                $model::deleted($bust);
            }
        };

        // Finance figures feed both the finance dashboard and the admin analytics finance KPIs.
        $registerBust(
            [FinanceTransaction::class, CustomerInvoice::class, Expense::class, EmployeeDebitRequest::class],
            ['finance.dashboard.v1', 'admin.analytics.v1'],
        );
        // Task/order/user counts feed only the admin analytics payload.
        $registerBust(
            [Order::class, Task::class, User::class],
            ['admin.analytics.v1'],
        );
    }
}
