<?php

use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\HealthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| These routes are loaded by bootstrap/app.php with the default "api"
| middleware group and the /api prefix. CORS is handled globally (see
| bootstrap/app.php and config/cors.php), so every route below is callable
| from the JobPilot dashboard in the browser.
|
*/

Route::get('/health', HealthController::class)->name('health');

Route::prefix('analytics')->name('analytics.')->group(function (): void {
    Route::get('/summary', [AnalyticsController::class, 'summary'])->name('summary');
    Route::get('/funnel', [AnalyticsController::class, 'funnel'])->name('funnel');
    Route::get('/portals', [AnalyticsController::class, 'portals'])->name('portals');
});
