<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\PasswordResetController;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            Route::post('/api/login', [AuthController::class, 'login'])->middleware('api');

            // Public password-reset flow. Throttled to deter abuse / email-enumeration.
            Route::middleware(['api', 'throttle:6,1'])->group(function () {
                Route::post('/api/password/forgot', [PasswordResetController::class, 'forgot']);
                Route::post('/api/password/verify', [PasswordResetController::class, 'verify']);
                Route::post('/api/password/reset', [PasswordResetController::class, 'reset']);
            });
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
