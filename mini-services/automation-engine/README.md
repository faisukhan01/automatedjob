# JobPilot AI — Automation Engine

FastAPI microservice that powers autonomous job applications: it scores job
postings against a candidate profile, generates professional cover letters,
runs automation cycles, and serves mock job feeds for popular portals.

**Port:** `8001` (hardcoded) · **Engine tags:** `fastapi-scoring-v1`,
`fastapi-templates-v1`, `fastapi-automation-v1`

## Run

```bash
pip3 install -r requirements.txt
bun run dev            # uvicorn main:app --host 0.0.0.0 --port 8001 --reload
# or
python3 main.py
```

## Endpoints

| Method | Path                   | Description |
| ------ | ---------------------- | ----------- |
| GET    | `/health`              | Liveness probe: `{status, service, version, uptime_seconds, timestamp}` |
| POST   | `/score-jobs`          | Score a batch of jobs against a profile → `results[].{id, matchScore, matchedSkills, missingSkills, reasons}` |
| POST   | `/cover-letter`        | Generate a professional cover letter for one job → `{coverLetter, tone, engine}` |
| POST   | `/automation-cycle`    | Score + rank jobs, apply to those above `config.minMatchScore` (up to `config.dailyLimit`), generate cover letters → `{applied[], skipped[], summary}` |
| GET    | `/portal-feed/{slug}`  | Mock job feed. Supported slugs: `indeed`, `linkedin`, `glassdoor`, `ziprecruiter`, `monster`, `naukri`. Unknown slug → 404 |

CORS is enabled for all origins. Request/response bodies are validated with
Pydantic models (camelCase JSON keys).

## Scoring algorithm (`fastapi-scoring-v1`)

Deterministic, clamped to **35..98**:

- **Skills:** +12 per matched skill (case-insensitive), capped at +48
- **Role:** +22 if a desired role phrase appears in the job title, +12 for a
  partial keyword/token match
- **Salary:** +15 if `salaryMin >= profile.minSalary`; +8 if `salaryMax`
  clears the minimum; +10 if the profile sets no minimum
- **Location:** +12 if remote; +8 if the location substring-matches a desired
  location

## Automation cycle

Jobs are scored and sorted by match score (descending). Jobs scoring at least
`minMatchScore` are "applied" (up to `dailyLimit`, each with an optional
generated cover letter); the rest are skipped with a reason
(`below min match score (N)` or `daily limit reached (N)`).

## Example

```bash
curl -s http://localhost:8001/health
curl -s -X POST http://localhost:8001/score-jobs \
  -H 'Content-Type: application/json' \
  -d '{"profile":{"skills":["React","Next.js"],"desiredRoles":["Full-Stack Engineer"],"minSalary":55000,"remoteOnly":false,"yearsExperience":5,"desiredLocations":["Remote"]},"jobs":[{"id":"j1","title":"Senior Full-Stack Engineer","company":"X","location":"Remote","remote":true,"salaryMin":80000,"salaryMax":120000,"skills":["React","Next.js"],"description":"..."}]}'
```
