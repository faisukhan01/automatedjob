<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Closure;
use DateTimeImmutable;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

/**
 * Analytics & reporting endpoints for the JobPilot AI platform.
 *
 * Every aggregate is computed in-memory from a deterministic mock dataset
 * (see {@see self::generateApplications()}): a Park–Miller linear congruential
 * generator is seeded from the calendar date (Ymd), so the numbers for any
 * given date are stable across requests, restarts and deployments. The service
 * therefore has no database dependency at all.
 *
 * NOTE — production: a real deployment would replace generateApplications()
 * with a query against the shared JobPilot applications database (or an HTTP
 * call to the automation engine). Everything downstream — aggregation, funnel
 * math, response rates — would stay exactly the same.
 */
final class AnalyticsController extends Controller
{
    /** Number of days used when neither `from` nor `to` is provided. */
    private const DEFAULT_WINDOW_DAYS = 14;

    /** Maximum allowed window length (protects the response size). */
    private const MAX_WINDOW_DAYS = 92;

    /**
     * Mock application sources with sampling weights (sum to 100) and
     * per-portal conversion probabilities. Statuses are mutually exclusive
     * and ordered by progress: screening -> interview -> offer, while
     * "rejected" (explicit no) and "ghosted" (no response at all) are the
     * terminal negative outcomes.
     *
     * @var array<string, array{label: string, weight: int, p_screening: float, p_interview: float, p_offer: float, p_rejected: float}>
     */
    private const PORTALS = [
        'linkedin' => [
            'label' => 'LinkedIn', 'weight' => 34,
            'p_screening' => 0.140, 'p_interview' => 0.060, 'p_offer' => 0.015, 'p_rejected' => 0.340,
        ],
        'indeed' => [
            'label' => 'Indeed', 'weight' => 26,
            'p_screening' => 0.100, 'p_interview' => 0.045, 'p_offer' => 0.010, 'p_rejected' => 0.380,
        ],
        'glassdoor' => [
            'label' => 'Glassdoor', 'weight' => 14,
            'p_screening' => 0.090, 'p_interview' => 0.040, 'p_offer' => 0.008, 'p_rejected' => 0.400,
        ],
        'company' => [
            'label' => 'Company Site', 'weight' => 16,
            'p_screening' => 0.120, 'p_interview' => 0.055, 'p_offer' => 0.012, 'p_rejected' => 0.300,
        ],
        'referral' => [
            'label' => 'Referral', 'weight' => 10,
            'p_screening' => 0.220, 'p_interview' => 0.120, 'p_offer' => 0.040, 'p_rejected' => 0.220,
        ],
    ];

    /** Statuses meaning "received a positive response" (moved past applied). */
    private const PROGRESS_STATUSES = ['screening', 'interview', 'offer'];

    /** Statuses meaning "reached the interview stage" (offers are a subset). */
    private const INTERVIEW_STATUSES = ['interview', 'offer'];

    /**
     * Aggregate overview: totals, per-portal breakdown, daily series and
     * funnel counts.
     *
     * GET /api/analytics/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&portal=key
     */
    public function summary(Request $request): JsonResponse
    {
        [$from, $to] = $this->resolveWindow($request);
        $portal = $this->resolvePortal($request);

        $applications = $this->collectApplications($from, $to, $portal);
        $aggregate = $this->aggregate($applications, $from, $to);

        return response()->json([
            'window' => $this->windowPayload($from, $to),
            'portal' => $portal,
            'totals' => $aggregate['totals'],
            'byPortal' => $aggregate['byPortal'],
            'byDay' => $aggregate['byDay'],
            'funnel' => $aggregate['funnel'],
        ]);
    }

    /**
     * Application funnel with per-stage counts, percentages (relative to
     * applications) and stage-to-stage conversion rates.
     *
     * GET /api/analytics/funnel?from=YYYY-MM-DD&to=YYYY-MM-DD&portal=key
     */
    public function funnel(Request $request): JsonResponse
    {
        [$from, $to] = $this->resolveWindow($request);
        $portal = $this->resolvePortal($request);

        $applications = $this->collectApplications($from, $to, $portal);

        $counts = ['applied' => 0, 'screening' => 0, 'interview' => 0, 'offer' => 0];
        $counts['applied'] = count($applications);

        foreach ($applications as $application) {
            if ($application['status'] === 'screening') {
                $counts['screening']++;
            }

            if (in_array($application['status'], self::INTERVIEW_STATUSES, true)) {
                $counts['screening']++;
                $counts['interview']++;
            }

            if ($application['status'] === 'offer') {
                $counts['offer']++;
            }
        }

        $stages = [];
        $previousCount = null;

        foreach ($counts as $stage => $count) {
            $stages[] = [
                'stage' => $stage,
                'count' => $count,
                'percentage' => self::rate($count, $counts['applied']),
                'conversionFromPrevious' => ($previousCount !== null && $previousCount > 0)
                    ? self::rate($count, $previousCount)
                    : null,
            ];

            $previousCount = $count;
        }

        return response()->json([
            'window' => $this->windowPayload($from, $to),
            'portal' => $portal,
            'stages' => $stages,
        ]);
    }

    /**
     * Per-portal performance across the window: application counts, estimated
     * response rate, interview rate and the best performing portal.
     *
     * GET /api/analytics/portals?from=YYYY-MM-DD&to=YYYY-MM-DD
     */
    public function portals(Request $request): JsonResponse
    {
        [$from, $to] = $this->resolveWindow($request);

        $applications = $this->collectApplications($from, $to, null);

        $stats = [];
        foreach (self::PORTALS as $key => $config) {
            $stats[$key] = ['applications' => 0, 'interviews' => 0, 'offers' => 0, 'responses' => 0];
        }

        foreach ($applications as $application) {
            $key = $application['portal'];
            $status = $application['status'];

            $stats[$key]['applications']++;

            if (in_array($status, self::INTERVIEW_STATUSES, true)) {
                $stats[$key]['interviews']++;
            }

            if ($status === 'offer') {
                $stats[$key]['offers']++;
            }

            if (in_array($status, self::PROGRESS_STATUSES, true)) {
                $stats[$key]['responses']++;
            }
        }

        $portals = [];
        $best = null;

        // Fixed declaration order keeps the payload stable; ties on
        // responseRate are broken by this declaration order as well.
        foreach (self::PORTALS as $key => $config) {
            $entry = [
                'portal' => $key,
                'label' => $config['label'],
                'applications' => $stats[$key]['applications'],
                'interviews' => $stats[$key]['interviews'],
                'offers' => $stats[$key]['offers'],
                'responseRate' => self::rate($stats[$key]['responses'], $stats[$key]['applications']),
                'interviewRate' => self::rate($stats[$key]['interviews'], $stats[$key]['applications']),
            ];

            $portals[] = $entry;

            if ($stats[$key]['applications'] > 0
                && ($best === null || $entry['responseRate'] > $best['responseRate'])) {
                $best = [
                    'portal' => $key,
                    'label' => $config['label'],
                    'responseRate' => $entry['responseRate'],
                    'applications' => $stats[$key]['applications'],
                ];
            }
        }

        $aggregate = $this->aggregate($applications, $from, $to);

        return response()->json([
            'window' => $this->windowPayload($from, $to),
            'totals' => $aggregate['totals'],
            'portals' => $portals,
            'bestPortal' => $best,
        ]);
    }

    // -------------------------------------------------------------------------
    // Aggregation
    // -------------------------------------------------------------------------

    /**
     * Build every aggregate for a set of applications.
     *
     * @param  array<int, array{date: string, portal: string, status: string}>  $applications
     * @return array{totals: array{applications: int, interviews: int, offers: int, responseRate: float}, byPortal: list<array{portal: string, label: string, applications: int, interviews: int, offers: int, responseRate: float}>, byDay: list<array{date: string, applications: int, interviews: int, offers: int, responseRate: float}>, funnel: array{applied: int, screening: int, interview: int, offer: int}}
     */
    private function aggregate(array $applications, DateTimeImmutable $from, DateTimeImmutable $to): array
    {
        $totals = ['applications' => 0, 'interviews' => 0, 'offers' => 0, 'responses' => 0];

        $portalStats = [];
        foreach (self::PORTALS as $key => $config) {
            $portalStats[$key] = ['applications' => 0, 'interviews' => 0, 'offers' => 0, 'responses' => 0];
        }

        // Every day of the window appears in byDay, even with zero applications.
        $dayStats = [];
        for ($cursor = $from; $cursor <= $to; $cursor = $cursor->modify('+1 day')) {
            $dayStats[$cursor->format('Y-m-d')] = ['applications' => 0, 'interviews' => 0, 'offers' => 0, 'responses' => 0];
        }

        foreach ($applications as $application) {
            $status = $application['status'];

            $reachedInterview = in_array($status, self::INTERVIEW_STATUSES, true);
            $reachedScreening = $reachedInterview || $status === 'screening';

            $totals['applications']++;
            if ($reachedInterview) {
                $totals['interviews']++;
            }
            if ($status === 'offer') {
                $totals['offers']++;
            }
            if ($reachedScreening) {
                $totals['responses']++;
            }

            $portal = $application['portal'];
            $portalStats[$portal]['applications']++;
            if ($reachedInterview) {
                $portalStats[$portal]['interviews']++;
            }
            if ($status === 'offer') {
                $portalStats[$portal]['offers']++;
            }
            if ($reachedScreening) {
                $portalStats[$portal]['responses']++;
            }

            $day = $application['date'];
            $dayStats[$day]['applications']++;
            if ($reachedInterview) {
                $dayStats[$day]['interviews']++;
            }
            if ($status === 'offer') {
                $dayStats[$day]['offers']++;
            }
            if ($reachedScreening) {
                $dayStats[$day]['responses']++;
            }
        }

        $byPortal = [];
        foreach (self::PORTALS as $key => $config) {
            if ($portalStats[$key]['applications'] === 0) {
                continue; // Portals without traffic in the window are omitted here.
            }

            $byPortal[] = [
                'portal' => $key,
                'label' => $config['label'],
                'applications' => $portalStats[$key]['applications'],
                'interviews' => $portalStats[$key]['interviews'],
                'offers' => $portalStats[$key]['offers'],
                'responseRate' => self::rate($portalStats[$key]['responses'], $portalStats[$key]['applications']),
            ];
        }

        $byDay = [];
        foreach ($dayStats as $date => $stats) {
            $byDay[] = [
                'date' => $date,
                'applications' => $stats['applications'],
                'interviews' => $stats['interviews'],
                'offers' => $stats['offers'],
                'responseRate' => self::rate($stats['responses'], $stats['applications']),
            ];
        }

        return [
            'totals' => [
                'applications' => $totals['applications'],
                'interviews' => $totals['interviews'],
                'offers' => $totals['offers'],
                'responseRate' => self::rate($totals['responses'], $totals['applications']),
            ],
            'byPortal' => $byPortal,
            'byDay' => $byDay,
            'funnel' => [
                'applied' => $totals['applications'],
                'screening' => $totals['responses'],
                'interview' => $totals['interviews'],
                'offer' => $totals['offers'],
            ],
        ];
    }

    /**
     * Percentage of $whole represented by $part, rounded to one decimal.
     * Returns 0.0 for empty windows to avoid division by zero.
     */
    private static function rate(int $part, int $whole): float
    {
        return $whole > 0 ? round($part / $whole * 100, 1) : 0.0;
    }

    // -------------------------------------------------------------------------
    // Request input
    // -------------------------------------------------------------------------

    /**
     * Resolve and validate the from/to window.
     *
     * Defaults: to = today, from = to - (DEFAULT_WINDOW_DAYS - 1) days,
     * i.e. a rolling 14-day window inclusive of both endpoints.
     *
     * @return array{DateTimeImmutable, DateTimeImmutable}
     */
    private function resolveWindow(Request $request): array
    {
        $fromParam = $request->query('from');
        $toParam = $request->query('to');

        if ($fromParam !== null && ! is_string($fromParam)) {
            $this->fail('The "from" query parameter must be a single Y-m-d date string.');
        }

        if ($toParam !== null && ! is_string($toParam)) {
            $this->fail('The "to" query parameter must be a single Y-m-d date string.');
        }

        $today = new DateTimeImmutable('today');

        if ($toParam === null) {
            $to = $today;
        } else {
            try {
                $to = $this->parseDate($toParam);
            } catch (InvalidArgumentException) {
                $this->fail('The "to" query parameter must be a valid Y-m-d date (example: 2026-01-22).');
            }
        }

        if ($fromParam === null) {
            $from = $to->modify('-'.(self::DEFAULT_WINDOW_DAYS - 1).' days');
        } else {
            try {
                $from = $this->parseDate($fromParam);
            } catch (InvalidArgumentException) {
                $this->fail('The "from" query parameter must be a valid Y-m-d date (example: 2026-01-22).');
            }
        }

        if ($from > $to) {
            $this->fail('The "from" date must be on or before the "to" date.');
        }

        $days = (int) $from->diff($to)->format('%a') + 1;

        if ($days > self::MAX_WINDOW_DAYS) {
            $this->fail(sprintf(
                'The requested window is %d days long; the maximum is %d days.',
                $days,
                self::MAX_WINDOW_DAYS,
            ));
        }

        return [$from, $to];
    }

    /**
     * Validate the optional `portal` filter against the known portals.
     */
    private function resolvePortal(Request $request): ?string
    {
        $portal = $request->query('portal');

        if ($portal === null) {
            return null;
        }

        if (! is_string($portal) || ! array_key_exists($portal, self::PORTALS)) {
            $this->fail(sprintf(
                'Unknown portal filter. Supported values: %s.',
                implode(', ', array_keys(self::PORTALS)),
            ));
        }

        return $portal;
    }

    /**
     * Strictly parse a Y-m-d date (rejects values PHP would leniently accept,
     * such as "2026-1-5").
     */
    private function parseDate(string $value): DateTimeImmutable
    {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);

        if ($date === false || $date->format('Y-m-d') !== $value) {
            throw new InvalidArgumentException(sprintf('"%s" is not a valid Y-m-d date.', $value));
        }

        return $date;
    }

    /**
     * Abort with a JSON 422 error payload (see README "Errors").
     */
    private function fail(string $message): never
    {
        throw new HttpResponseException(response()->json([
            'error' => 'invalid_request',
            'message' => $message,
        ], 422));
    }

    // -------------------------------------------------------------------------
    // Mock data generation (deterministic — replace with a DB query in prod)
    // -------------------------------------------------------------------------

    /**
     * Generate the deterministic mock application dataset for a window.
     *
     * Determinism contract:
     *  - The PRNG (Park–Miller LCG) is seeded with the calendar date (Ymd),
     *    so a given date always produces the same cohort of applications,
     *    regardless of when the endpoint is called or the process restarted.
     *    Historical days never change; "today" is stable for the whole day.
     *  - Weekdays produce 3–10 applications, weekends 1–3.
     *  - Each application's portal and outcome are sampled from the per-portal
     *    conversion probabilities declared in PORTALS (one PRNG draw each,
     *    in that order).
     *
     * @return array<int, array{date: string, portal: string, status: string}>
     */
    private function generateApplications(DateTimeImmutable $from, DateTimeImmutable $to): array
    {
        $applications = [];

        for ($cursor = $from; $cursor <= $to; $cursor = $cursor->modify('+1 day')) {
            $random = $this->lcg((int) $cursor->format('Ymd'));

            $isWeekend = (int) $cursor->format('N') >= 6; // 6 = Saturday, 7 = Sunday

            $count = $isWeekend
                ? 1 + (int) floor($random() * 3)     // 1–3 applications
                : 3 + (int) floor($random() * 8);    // 3–10 applications

            for ($i = 0; $i < $count; $i++) {
                $portal = $this->pickPortal($random);
                $status = $this->pickStatus($portal, $random);

                $applications[] = [
                    'date' => $cursor->format('Y-m-d'),
                    'portal' => $portal,
                    'status' => $status,
                ];
            }
        }

        return $applications;
    }

    /**
     * Filter the generated dataset by the optional portal parameter.
     *
     * @return array<int, array{date: string, portal: string, status: string}>
     */
    private function collectApplications(DateTimeImmutable $from, DateTimeImmutable $to, ?string $portal): array
    {
        $applications = $this->generateApplications($from, $to);

        if ($portal === null) {
            return $applications;
        }

        return array_values(array_filter(
            $applications,
            static fn (array $application): bool => $application['portal'] === $portal,
        ));
    }

    /**
     * Pick a portal using weighted sampling (weights sum to 100).
     */
    private function pickPortal(Closure $random): string
    {
        $roll = $random() * 100;
        $cumulative = 0.0;

        foreach (self::PORTALS as $key => $config) {
            $cumulative += $config['weight'];

            if ($roll < $cumulative) {
                return $key;
            }
        }

        return 'linkedin'; // Unreachable: weights sum to exactly 100.
    }

    /**
     * Pick the application outcome for a portal from its conversion rates.
     */
    private function pickStatus(string $portal, Closure $random): string
    {
        $config = self::PORTALS[$portal];
        $roll = $random();

        $cumulative = $config['p_screening'];
        if ($roll < $cumulative) {
            return 'screening';
        }

        $cumulative += $config['p_interview'];
        if ($roll < $cumulative) {
            return 'interview';
        }

        $cumulative += $config['p_offer'];
        if ($roll < $cumulative) {
            return 'offer';
        }

        $cumulative += $config['p_rejected'];
        if ($roll < $cumulative) {
            return 'rejected';
        }

        return 'ghosted';
    }

    /**
     * Park–Miller minimal standard PRNG (LCG), seeded per calendar date.
     *
     * Returns a closure producing floats in the [0, 1) range. Requires
     * 64-bit PHP (intermediate products reach ~2^47), which is guaranteed
     * by the php ^8.2 constraint on all supported platforms.
     */
    private function lcg(int $seed): Closure
    {
        $state = $seed % 2147483646;

        if ($state <= 0) {
            $state = 2147483646;
        }

        return static function () use (&$state): float {
            $state = ($state * 48271) % 2147483647;

            return $state / 2147483647;
        };
    }

    /**
     * @return array{from: string, to: string, days: int}
     */
    private function windowPayload(DateTimeImmutable $from, DateTimeImmutable $to): array
    {
        return [
            'from' => $from->format('Y-m-d'),
            'to' => $to->format('Y-m-d'),
            'days' => (int) $from->diff($to)->format('%a') + 1,
        ];
    }
}
