<?php

use App\Http\Middleware\CorsMiddleware;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

/*
|--------------------------------------------------------------------------
| Create The Application
|--------------------------------------------------------------------------
|
| Laravel 11 style application bootstrap: routing, middleware and exception
| behaviour are declared fluently on the application builder. The resulting
| Illuminate\Foundation\Application instance is returned to the front
| controllers (public/index.php) and to the artisan entry point.
|
*/

$app = Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Reusable route middleware alias: ->middleware('cors')
        $middleware->alias([
            'cors' => CorsMiddleware::class,
        ]);

        // Also run CORS for every request on the global stack so that OPTIONS
        // preflights are answered before routing (no 405s for preflights).
        $middleware->append([
            CorsMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })
    ->create();

return $app;
