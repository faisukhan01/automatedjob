<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Liveness / readiness probe for orchestration tools and the gateway.
 */
final class HealthController extends Controller
{
    /**
     * Report the service status.
     *
     * GET /api/health
     */
    public function __invoke(Request $request): JsonResponse
    {
        return response()->json([
            'service' => 'jobpilot-analytics',
            'status' => 'ok',
            'laravel' => true,
            'time' => now()->toIso8601String(),
        ]);
    }
}
