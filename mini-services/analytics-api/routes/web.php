<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Only a tiny index payload lives here — the real surface of this service
| is the JSON API under /api (see routes/api.php).
|
*/

Route::get('/', static function () {
    return response()->json([
        'service' => 'jobpilot-analytics',
        'description' => 'JobPilot AI analytics & reporting microservice (Laravel 11).',
        'endpoints' => [
            'GET /api/health',
            'GET /api/analytics/summary?from=&to=&portal=',
            'GET /api/analytics/funnel?from=&to=&portal=',
            'GET /api/analytics/portals?from=&to=',
        ],
    ]);
})->name('home');
