<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Answers CORS preflight requests directly and decorates every response
 * with permissive CORS headers, so the JobPilot dashboard (Next.js on
 * port 3000) can call this API from the browser during local development.
 *
 * Registered globally in bootstrap/app.php (plus the reusable "cors"
 * alias for route-level usage). Complements config/cors.php, which is
 * consumed by Laravel's built-in HandleCors middleware.
 */
final class CorsMiddleware
{
    private const ALLOWED_ORIGIN = '*';

    private const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

    private const ALLOWED_HEADERS = 'Content-Type, Accept, Authorization, X-Requested-With, X-Transform-Port';

    private const PREFLIGHT_CACHE_SECONDS = 86400;

    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Short-circuit preflight requests before routing even happens.
        if (strtoupper($request->getMethod()) === 'OPTIONS') {
            return response('', 204)
                ->header('Access-Control-Allow-Origin', self::ALLOWED_ORIGIN)
                ->header('Access-Control-Allow-Methods', self::ALLOWED_METHODS)
                ->header('Access-Control-Allow-Headers', self::ALLOWED_HEADERS)
                ->header('Access-Control-Max-Age', (string) self::PREFLIGHT_CACHE_SECONDS);
        }

        /** @var Response $response */
        $response = $next($request);

        $response->headers->set('Access-Control-Allow-Origin', self::ALLOWED_ORIGIN);
        $response->headers->set('Access-Control-Allow-Methods', self::ALLOWED_METHODS);
        $response->headers->set('Access-Control-Allow-Headers', self::ALLOWED_HEADERS);

        return $response;
    }
}
