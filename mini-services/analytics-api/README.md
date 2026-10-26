# JobPilot Analytics API

Laravel 11 micro-service that powers **reporting & analytics** for **JobPilot AI** — the autonomous job application platform. It is the third pillar of the JobPilot architecture:

| Pillar | Stack | Port | Role |
| --- | --- | --- | --- |
| JobPilot Dashboard | Next.js 16 | 3000 | Main web app / control panel |
| Automation Engine | Python · FastAPI | 8001 | Autonomous application execution |
| **Analytics API** *(this service)* | PHP 8.2 · Laravel 11 | **8002** | Aggregates, funnels & per-portal performance |

The service is **completely stateless**: every aggregate is computed in memory from a *deterministic* mock dataset, so it runs with zero infrastructure (no database, no Redis). A production deployment would swap the dataset generator for a query against the shared JobPilot applications database — nothing else changes.

---

## Quick start

Requires **PHP 8.2+** and **Composer**.

```bash
cd mini-services/analytics-api
composer install
cp .env.example .env
php artisan key:generate
php artisan serve --port=8002
```

Smoke test:

```bash
curl http://127.0.0.1:8002/api/health
```

Run the test suite (optional):

```bash
php artisan test
```

---

## Endpoints

| Method | Endpoint | Query params | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | — | Liveness probe (`service`, `status`, `laravel`, `time`) |
| `GET` | `/api/analytics/summary` | `from`, `to`, `portal` *(all optional)* | Totals, per-portal breakdown, daily series, funnel counts |
| `GET` | `/api/analytics/funnel` | `from`, `to`, `portal` | Stage counts, percentages and stage-to-stage conversion |
| `GET` | `/api/analytics/portals` | `from`, `to` | Per-portal performance + best portal |
| `GET` | `/up` | — | Laravel 11 built-in health route (registered in `bootstrap/app.php`) |

**Window semantics** — `from`/`to` are strict `Y-m-d` dates, inclusive on both ends. When omitted: `to` = today, `from` = `to − 13 days` (a rolling 14-day window). Windows longer than 92 days are rejected. `portal` filters everything (one of `linkedin`, `indeed`, `glassdoor`, `company`, `referral`).

**Metric semantics**

- `responseRate` — share of applications that moved past *applied* (status ∈ screening/interview/offer), in percent, 1 decimal. Silence (*ghosted*) and explicit rejections do **not** count as responses.
- `interviews` — applications that reached the interview stage; **offers are a subset of interviews**.
- Funnel `percentage` is relative to `applied`; `conversionFromPrevious` is stage-to-stage.

> Example responses below were generated for the **fixed window `2026-10-19 → 2026-11-01`**. Because the mock dataset is a pure function of the calendar date, anyone can reproduce these byte-identical numbers at any time by requesting that exact window. Real responses are compact single-line JSON; they are pretty-printed here for readability.

### `GET /api/health`

```json
{
  "service": "jobpilot-analytics",
  "status": "ok",
  "laravel": true,
  "time": "2026-11-01T17:42:07.318912+00:00"
}
```

*(The `time` value is the ISO-8601 server time at request — it naturally varies.)*

### `GET /api/analytics/summary?from=2026-10-19&to=2026-11-01`

```json
{
  "window": {
    "from": "2026-10-19",
    "to": "2026-11-01",
    "days": 14
  },
  "portal": null,
  "totals": {
    "applications": 68,
    "interviews": 3,
    "offers": 0,
    "responseRate": 16.2
  },
  "byPortal": [
    { "portal": "linkedin",  "label": "LinkedIn",     "applications": 26, "interviews": 3, "offers": 0, "responseRate": 23.1 },
    { "portal": "indeed",    "label": "Indeed",       "applications": 17, "interviews": 0, "offers": 0, "responseRate": 5.9 },
    { "portal": "glassdoor", "label": "Glassdoor",    "applications": 8,  "interviews": 0, "offers": 0, "responseRate": 0.0 },
    { "portal": "company",   "label": "Company Site", "applications": 9,  "interviews": 0, "offers": 0, "responseRate": 11.1 },
    { "portal": "referral",  "label": "Referral",     "applications": 8,  "interviews": 0, "offers": 0, "responseRate": 37.5 }
  ],
  "byDay": [
    { "date": "2026-10-19", "applications": 6, "interviews": 0, "offers": 0, "responseRate": 16.7 },
    { "date": "2026-10-20", "applications": 6, "interviews": 1, "offers": 0, "responseRate": 33.3 },
    { "date": "2026-10-21", "applications": 6, "interviews": 0, "offers": 0, "responseRate": 16.7 },
    { "date": "2026-10-22", "applications": 6, "interviews": 0, "offers": 0, "responseRate": 0.0 },
    { "date": "2026-10-23", "applications": 6, "interviews": 0, "offers": 0, "responseRate": 16.7 },
    { "date": "2026-10-24", "applications": 2, "interviews": 0, "offers": 0, "responseRate": 0.0 },
    { "date": "2026-10-25", "applications": 2, "interviews": 0, "offers": 0, "responseRate": 0.0 },
    { "date": "2026-10-26", "applications": 6, "interviews": 0, "offers": 0, "responseRate": 0.0 },
    { "date": "2026-10-27", "applications": 6, "interviews": 0, "offers": 0, "responseRate": 16.7 },
    { "date": "2026-10-28", "applications": 6, "interviews": 1, "offers": 0, "responseRate": 33.3 },
    { "date": "2026-10-29", "applications": 6, "interviews": 0, "offers": 0, "responseRate": 16.7 },
    { "date": "2026-10-30", "applications": 6, "interviews": 1, "offers": 0, "responseRate": 33.3 },
    { "date": "2026-10-31", "applications": 2, "interviews": 0, "offers": 0, "responseRate": 0.0 },
    { "date": "2026-11-01", "applications": 2, "interviews": 0, "offers": 0, "responseRate": 0.0 }
  ],
  "funnel": {
    "applied": 68,
    "screening": 11,
    "interview": 3,
    "offer": 0
  }
}
```

Notice the weekday/weekend rhythm: 6 applications on weekdays, 2 on weekends (2026-10-24/25 and 10-31/11-01).

### `GET /api/analytics/summary?from=2026-10-19&to=2026-11-01&portal=referral`

```json
{
  "window": { "from": "2026-10-19", "to": "2026-11-01", "days": 14 },
  "portal": "referral",
  "totals": { "applications": 8, "interviews": 0, "offers": 0, "responseRate": 37.5 },
  "byPortal": [
    { "portal": "referral", "label": "Referral", "applications": 8, "interviews": 0, "offers": 0, "responseRate": 37.5 }
  ],
  "byDay": [
    { "date": "2026-10-19", "applications": 2, "interviews": 0, "offers": 0, "responseRate": 50.0 },
    { "date": "2026-10-20", "applications": 2, "interviews": 0, "offers": 0, "responseRate": 50.0 },
    { "date": "2026-10-21", "applications": 0, "interviews": 0, "offers": 0, "responseRate": 0.0 },
    { "date": "2026-10-22", "applications": 0, "interviews": 0, "offers": 0, "responseRate": 0.0 },
    { "date": "2026-10-23", "applications": 0, "interviews": 0, "offers": 0, "responseRate": 0.0 },
    { "date": "2026-10-24", "applications": 0, "interviews": 0, "offers": 0, "responseRate": 0.0 },
    { "date": "2026-10-25", "applications": 0, "interviews": 0, "offers": 0, "responseRate": 0.0 },
    { "date": "2026-10-26", "applications": 1, "interviews": 0, "offers": 0, "responseRate": 0.0 },
    { "date": "2026-10-27", "applications": 0, "interviews": 0, "offers": 0, "responseRate": 0.0 },
    { "date": "2026-10-28", "applications": 0, "interviews": 0, "offers": 0, "responseRate": 0.0 },
    { "date": "2026-10-29", "applications": 3, "interviews": 0, "offers": 0, "responseRate": 33.3 },
    { "date": "2026-10-30", "applications": 0, "interviews": 0, "offers": 0, "responseRate": 0.0 },
    { "date": "2026-10-31", "applications": 0, "interviews": 0, "offers": 0, "responseRate": 0.0 },
    { "date": "2026-11-01", "applications": 0, "interviews": 0, "offers": 0, "responseRate": 0.0 }
  ],
  "funnel": { "applied": 8, "screening": 3, "interview": 0, "offer": 0 }
}
```

### `GET /api/analytics/funnel?from=2026-10-19&to=2026-11-01`

```json
{
  "window": { "from": "2026-10-19", "to": "2026-11-01", "days": 14 },
  "portal": null,
  "stages": [
    { "stage": "applied",   "count": 68, "percentage": 100.0, "conversionFromPrevious": null },
    { "stage": "screening", "count": 11, "percentage": 16.2,  "conversionFromPrevious": 16.2 },
    { "stage": "interview", "count": 3,  "percentage": 4.4,   "conversionFromPrevious": 27.3 },
    { "stage": "offer",     "count": 0,  "percentage": 0.0,   "conversionFromPrevious": 0.0 }
  ]
}
```

Stages follow **applied → screening → interview → offer**. `percentage` is relative to `applied`; `conversionFromPrevious` is the stage-to-stage rate (`null` for the first stage and whenever the previous stage is empty).

### `GET /api/analytics/portals?from=2026-10-19&to=2026-11-01`

```json
{
  "window": { "from": "2026-10-19", "to": "2026-11-01", "days": 14 },
  "totals": { "applications": 68, "interviews": 3, "offers": 0, "responseRate": 16.2 },
  "portals": [
    { "portal": "linkedin",  "label": "LinkedIn",     "applications": 26, "interviews": 3, "offers": 0, "responseRate": 23.1, "interviewRate": 11.5 },
    { "portal": "indeed",    "label": "Indeed",       "applications": 17, "interviews": 0, "offers": 0, "responseRate": 5.9,  "interviewRate": 0.0 },
    { "portal": "glassdoor", "label": "Glassdoor",    "applications": 8,  "interviews": 0, "offers": 0, "responseRate": 0.0,  "interviewRate": 0.0 },
    { "portal": "company",   "label": "Company Site", "applications": 9,  "interviews": 0, "offers": 0, "responseRate": 11.1, "interviewRate": 0.0 },
    { "portal": "referral",  "label": "Referral",     "applications": 8,  "interviews": 0, "offers": 0, "responseRate": 37.5, "interviewRate": 0.0 }
  ],
  "bestPortal": {
    "portal": "referral",
    "label": "Referral",
    "responseRate": 37.5,
    "applications": 8
  }
}
```

All five portals are always listed (fixed declaration order); `bestPortal` ranks by `responseRate` among portals with traffic, ties broken by declaration order.

### Errors — `422`

Invalid input (bad `Y-m-d` dates, inverted range, window > 92 days, unknown portal) returns a structured JSON error, never an HTML page:

```json
{
  "error": "invalid_request",
  "message": "Unknown portal filter. Supported values: linkedin, indeed, glassdoor, company, referral."
}
```

---

## Deterministic mock data

`App\Http\Controllers\AnalyticsController::generateApplications()` synthesises the dataset:

- A **Park–Miller linear congruential generator** (`state = state × 48271 mod 2147483647`) is seeded with the calendar date as `YYYYMMDD`. A given date therefore always produces the same cohort of applications — stable across requests, restarts and machines. Historical days never change; *today* is stable for the whole day.
- **Volume:** weekdays generate 3–10 applications, weekends 1–3 (one PRNG draw per day).
- **Outcome sampling:** each application draws its portal (weighted: LinkedIn 34, Indeed 26, Glassdoor 14, Company Site 16, Referral 10) and then its final status from per-portal conversion probabilities:

| Portal | screening | interview | offer | rejected | ghosted (silence) |
| --- | --- | --- | --- | --- | --- |
| LinkedIn | 14.0% | 6.0% | 1.5% | 34.0% | rest |
| Indeed | 10.0% | 4.5% | 1.0% | 38.0% | rest |
| Glassdoor | 9.0% | 4.0% | 0.8% | 40.0% | rest |
| Company Site | 12.0% | 5.5% | 1.2% | 30.0% | rest |
| Referral | 22.0% | 12.0% | 4.0% | 22.0% | rest |

Referrals convert best — which is exactly the story the dashboards should tell.

**Going to production:** replace `generateApplications()` with a repository/query against the shared JobPilot applications database (or an HTTP call to the automation engine). The aggregation, funnel and rate math above stays untouched. The `.env.example` already carries placeholder `DB_*` values for that migration.

---

## Integration with the JobPilot platform

### Through the gateway (recommended)

The platform gateway (root `Caddyfile`, port `81`) forwards any request carrying an `XTransformPort` query parameter to `localhost:{port}`. The dashboard therefore reaches this service as:

```
http://<gateway>:81/api/analytics/summary?XTransformPort=8002&from=2026-10-19&to=2026-11-01
http://<gateway>:81/api/analytics/funnel?XTransformPort=8002
http://<gateway>:81/api/analytics/portals?XTransformPort=8002
```

The gateway proxies straight to `http://localhost:8002/...`; the extra `XTransformPort` query parameter is simply ignored by this API (only `from`, `to` and `portal` are read).

### Directly from Next.js

Point the dashboard's server routes / client fetches at the service origin (e.g. `ANALYTICS_API_URL=http://127.0.0.1:8002` in the dashboard's `.env`) and call `/api/analytics/*` as documented above.

### CORS

- `config/cors.php` allows **all origins** for `api/*` (all methods, all headers, 24h preflight cache) and is consumed by Laravel's built-in `HandleCors` middleware.
- On top of that, `App\Http\Middleware\CorsMiddleware` is registered **globally** in `bootstrap/app.php`: it answers `OPTIONS` preflights with an immediate `204` (before routing, so preflights can never 405) and stamps `Access-Control-Allow-Origin/Methods/Headers` on every response.
- The middleware is also aliased as `cors`, so individual routes can opt in via `->middleware('cors')`.

Note: when traffic flows through the gateway the browser talks to port 81 only, so CORS rarely matters in that topology — it exists for direct browser calls during development.

---

## Project structure

```
analytics-api/
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── AnalyticsController.php   # the 3 analytics endpoints + aggregation math
│   │   │   ├── Controller.php            # base controller
│   │   │   └── HealthController.php      # GET /api/health
│   │   └── Middleware/
│   │       └── CorsMiddleware.php        # preflight 204 + permissive CORS headers
│   └── Providers/
│       └── AppServiceProvider.php
├── bootstrap/
│   ├── app.php                           # Laravel 11 Application builder (routing/middleware/health)
│   ├── cache/                            # framework cache (packages.php, services.php)
│   └── providers.php                     # [App\Providers\AppServiceProvider::class]
├── config/
│   ├── app.php
│   └── cors.php                          # allow-all origins for api/*
├── public/
│   ├── .htaccess
│   └── index.php                         # front controller
├── routes/
│   ├── api.php                           # /api/health + /api/analytics/*
│   ├── console.php
│   └── web.php                           # tiny JSON index
├── storage/                              # framework storage (.gitignore placeholders)
├── tests/
│   ├── Feature/AnalyticsApiTest.php      # smoke tests (deterministic assertions)
│   └── TestCase.php
├── .env.example
├── artisan
├── composer.json                         # jobpilot/analytics-api
├── phpunit.xml
├── server.php                            # PHP built-in server router (compat)
└── README.md
```

### Design notes (Laravel 11)

- **Slim skeleton style:** the app is bootstrapped exclusively through `bootstrap/app.php` using `Application::configure()` with `withRouting()` (web + api + commands + the built-in `/up` health route) and `withMiddleware()`. There is no `Kernel` class — this is the canonical Laravel 11 structure.
- **No database layer:** no migrations, models or Eloquent — the service is intentionally stateless. `config/` only carries the two files this service actually customises (`app.php`, `cors.php`); Laravel 11 merges the framework defaults for everything else.
- **Pure-PHP math:** aggregation uses plain arrays and integer/float math (PSR-12-ish, PHP 8.2 typed, `declare(strict_types=1)`), so the logic is trivially portable to a real database query later.
