"""JobPilot AI — Automation Engine.

A FastAPI microservice that:

* scores job postings against a user profile (``POST /score-jobs``),
* generates tailored professional cover letters (``POST /cover-letter``),
* runs an autonomous application cycle (``POST /automation-cycle``),
* serves mock job feeds for popular portals (``GET /portal-feed/{slug}``).

Run standalone with ``python3 main.py`` or via ``bun run dev`` (uvicorn with
auto-reload on port 8001).
"""

from __future__ import annotations

import re
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SERVICE_NAME = "automation-engine"
SERVICE_VERSION = "1.0.0"
HOST = "0.0.0.0"
PORT = 8001
PROCESS_START = time.time()

SCORING_ENGINE = "fastapi-scoring-v1"
TEMPLATES_ENGINE = "fastapi-templates-v1"
AUTOMATION_ENGINE = "fastapi-automation-v1"

# Scoring weights (deterministic algorithm, clamped to SCORE_FLOOR..SCORE_CEILING).
SKILL_POINTS_PER_MATCH = 12
SKILL_POINTS_CAP = 48
ROLE_FULL_POINTS = 22
ROLE_PARTIAL_POINTS = 12
SALARY_ABOVE_POINTS = 15
SALARY_OVERLAP_POINTS = 8
SALARY_FLEX_POINTS = 10
LOCATION_REMOTE_POINTS = 12
LOCATION_MATCH_POINTS = 8
SCORE_FLOOR = 35
SCORE_CEILING = 98

_ROLE_STOPWORDS = {"a", "an", "and", "the", "for", "with", "of", "in", "on", "to", "or"}

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class Profile(BaseModel):
    """A user's job-search profile (camelCase keys match the public API)."""

    fullName: str = ""
    headline: str = ""
    skills: List[str] = Field(default_factory=list)
    desiredRoles: List[str] = Field(default_factory=list)
    minSalary: float = 0
    remoteOnly: bool = False
    yearsExperience: int = 0
    desiredLocations: List[str] = Field(default_factory=list)


class Job(BaseModel):
    """A job posting as consumed by the scoring engine."""

    id: str
    title: str
    company: str = ""
    location: str = ""
    remote: bool = False
    salaryMin: Optional[float] = None
    salaryMax: Optional[float] = None
    skills: List[str] = Field(default_factory=list)
    description: str = ""


class FeedJob(Job):
    """A job in a portal feed, including a posting timestamp."""

    postedAt: str = ""


class ScoreRequest(BaseModel):
    profile: Profile
    jobs: List[Job]


class ScoredJob(BaseModel):
    id: str
    matchScore: int
    matchedSkills: List[str]
    missingSkills: List[str]
    reasons: List[str]


class ScoreResponse(BaseModel):
    results: List[ScoredJob]
    engine: str = SCORING_ENGINE


class CoverLetterRequest(BaseModel):
    profile: Profile
    job: Job


class CoverLetterResponse(BaseModel):
    coverLetter: str
    tone: str = "professional"
    engine: str = TEMPLATES_ENGINE


class AutomationConfig(BaseModel):
    dailyLimit: int = 20
    minMatchScore: int = 70
    autoCoverLetter: bool = True


class AutomationRequest(BaseModel):
    profile: Profile
    config: AutomationConfig
    jobs: List[Job]


class AppliedJob(BaseModel):
    jobId: str
    matchScore: int
    coverLetter: Optional[str] = None
    reasons: List[str] = Field(default_factory=list)


class SkippedJob(BaseModel):
    jobId: str
    matchScore: int
    reason: str


class AutomationSummary(BaseModel):
    total: int
    applied: int
    skipped: int
    avgMatchScore: float
    engine: str = AUTOMATION_ENGINE


class AutomationResponse(BaseModel):
    applied: List[AppliedJob]
    skipped: List[SkippedJob]
    summary: AutomationSummary


class PortalFeedResponse(BaseModel):
    portal: str
    jobs: List[FeedJob]


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    uptime_seconds: float
    timestamp: str


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="JobPilot AI — Automation Engine",
    description="Job scoring, cover-letter generation and autonomous application cycles.",
    version=SERVICE_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------


def _tokenize(text: str) -> List[str]:
    """Split text into lowercase role tokens (keeps c++, node.js, c# intact)."""
    tokens = re.findall(r"[a-z0-9.+#]+", text.lower())
    return [t for t in tokens if len(t) >= 3 and t not in _ROLE_STOPWORDS]


def _clean_list(values: List[str]) -> List[str]:
    """Lowercase/strip a list of strings, dropping empties."""
    return [v.strip().lower() for v in values if v and v.strip()]


def score_job(profile: Profile, job: Job) -> ScoredJob:
    """Deterministically score a single job against a profile (0-100, clamped 35..98).

    Components: skill overlap (capped +48), role/title match (+22 full / +12
    partial), salary (+15/+8/+10) and location (+12 remote / +8 match).
    """
    reasons: List[str] = []
    score = 0

    # 1. Skill overlap: +12 per matched skill, capped at +48 (case-insensitive).
    profile_skills = set(_clean_list(profile.skills))
    job_skills = _clean_list(job.skills)
    matched = [s for s in job_skills if s in profile_skills]
    missing = [s for s in job_skills if s not in profile_skills]
    score += min(len(matched) * SKILL_POINTS_PER_MATCH, SKILL_POINTS_CAP)
    if matched:
        reasons.append(f"{len(matched)}/{len(job_skills)} skills matched")
    else:
        reasons.append("no skill overlap")

    # 2. Role/title match: full desired-role phrase (+22) or partial token (+12).
    title_lower = job.title.lower()
    role_hit = False
    for role in _clean_list(profile.desiredRoles):
        if role in title_lower:
            score += ROLE_FULL_POINTS
            reasons.append(f"+{ROLE_FULL_POINTS} role match")
            role_hit = True
            break
    if not role_hit:
        role_tokens = {token for role in _clean_list(profile.desiredRoles) for token in _tokenize(role)}
        if any(token in title_lower for token in role_tokens):
            score += ROLE_PARTIAL_POINTS
            reasons.append(f"+{ROLE_PARTIAL_POINTS} partial role match")

    # 3. Salary: above minimum (+15), overlapping range (+8), flexible (+10).
    if job.salaryMin is not None and job.salaryMin >= profile.minSalary:
        score += SALARY_ABOVE_POINTS
        reasons.append("salary above minimum")
    elif job.salaryMax is not None and job.salaryMax >= profile.minSalary:
        score += SALARY_OVERLAP_POINTS
        reasons.append("salary range overlaps minimum")
    elif profile.minSalary == 0:
        score += SALARY_FLEX_POINTS
        reasons.append("no salary minimum required")
    elif job.salaryMin is None and job.salaryMax is None:
        reasons.append("salary not specified")
    else:
        reasons.append("salary below desired minimum")

    # 4. Location: remote (+12) or substring match with a desired location (+8).
    if job.remote:
        score += LOCATION_REMOTE_POINTS
        reasons.append("remote friendly")
    else:
        job_location = job.location.strip().lower()
        desired_locations = _clean_list(profile.desiredLocations)
        if job_location and any(
            job_location in desired or desired in job_location for desired in desired_locations
        ):
            score += LOCATION_MATCH_POINTS
            reasons.append(f"location match ({job.location.strip()})")

    score = max(SCORE_FLOOR, min(SCORE_CEILING, score))
    return ScoredJob(id=job.id, matchScore=score, matchedSkills=matched, missingSkills=missing, reasons=reasons)


# ---------------------------------------------------------------------------
# Cover-letter generation
# ---------------------------------------------------------------------------


def _matched_skills_for_letter(profile: Profile, job: Job) -> List[str]:
    """Return job skills that appear in the profile, preserving original casing."""
    profile_skills = set(_clean_list(profile.skills))
    return [skill.strip() for skill in job.skills if skill and skill.strip().lower() in profile_skills]


def build_cover_letter(profile: Profile, job: Job) -> str:
    """Generate a professional 3-paragraph cover letter for a job."""
    name = profile.fullName.strip() or "A Motivated Candidate"
    company = job.company.strip() or "your company"
    title = job.title.strip() or "the open role"
    years = max(int(profile.yearsExperience or 0), 0)
    matched = _matched_skills_for_letter(profile, job)

    greeting = "Dear Hiring Team,"
    intro = (
        f"I am writing to express my strong interest in the {title} role at {company}. "
        f"With {years}+ years of hands-on experience"
        + (f" as a {profile.headline.strip()}" if profile.headline.strip() else "")
        + ", I believe my background aligns closely with what your team is building, "
        "and I would be excited to contribute from day one."
    )

    if matched:
        skills_paragraph = (
            f"Throughout my career I have developed deep expertise in {', '.join(matched)}, "
            f"skills that map directly onto the core requirements of the {title} position. "
            "I have used them to ship production-grade systems, collaborate across disciplines, "
            f"and deliver measurable impact — experience I am eager to bring to {company}."
        )
    else:
        strengths = ", ".join(s.strip() for s in profile.skills[:6] if s.strip()) or "modern software development"
        skills_paragraph = (
            f"My professional experience aligns closely with the responsibilities of the {title} role. "
            f"My core strengths include {strengths}, and I have a proven track record of quickly mastering "
            f"new technologies, shipping production-grade work, and delivering measurable impact for {company}'s kind of challenges."
        )

    location_bits: List[str] = []
    if job.location.strip():
        location_bits.append(f"the {job.location.strip()} location")
    if job.remote:
        location_bits.append("a remote-friendly working arrangement")
    if location_bits:
        fit_paragraph = (
            "Beyond the technical fit, this opportunity stands out to me because of "
            + " and ".join(location_bits)
            + ". I thrive in environments that value clear communication and ownership, "
            "and I am confident I could make meaningful contributions quickly."
        )
    else:
        fit_paragraph = (
            "Beyond the technical fit, this opportunity stands out to me because of the chance to work "
            "with a team that values craftsmanship and continuous improvement. I thrive in environments "
            "that value clear communication and ownership, and I am confident I could make meaningful "
            "contributions quickly."
        )

    closing = (
        f"Thank you for taking the time to review my application. I would welcome the opportunity to "
        f"discuss how my experience can help {company} succeed.\n\nSincerely,\n{name}"
    )

    return "\n\n".join([greeting, intro, skills_paragraph, fit_paragraph, closing])


# ---------------------------------------------------------------------------
# Mock portal feeds
# ---------------------------------------------------------------------------


def _posted_ago(days: int) -> str:
    """Return an ISO-8601 timestamp `days` days in the past."""
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


_PORTAL_FEEDS: Dict[str, List[Dict]] = {
    "indeed": [
        {"id": "indeed-1", "title": "Senior Frontend Engineer", "company": "Shopify", "location": "Remote", "remote": True, "salaryMin": 110000, "salaryMax": 150000, "skills": ["React", "TypeScript", "Next.js", "GraphQL"], "description": "Own the storefront web experience used by millions of merchants; deep React and TypeScript expertise required."},
        {"id": "indeed-2", "title": "Backend Engineer (Python)", "company": "Stripe", "location": "San Francisco, CA", "remote": False, "salaryMin": 130000, "salaryMax": 175000, "skills": ["Python", "FastAPI", "PostgreSQL", "Docker"], "description": "Build payment APIs that process billions of dollars with correctness and low latency."},
        {"id": "indeed-3", "title": "Full-Stack Developer", "company": "Airtable", "location": "Remote", "remote": True, "salaryMin": 100000, "salaryMax": 140000, "skills": ["TypeScript", "Node.js", "React", "Prisma"], "description": "Work across the stack on the extensibility platform powering customer automations."},
        {"id": "indeed-4", "title": "DevOps Engineer", "company": "Datadog", "location": "New York, NY", "remote": False, "salaryMin": 120000, "salaryMax": 160000, "skills": ["Kubernetes", "Terraform", "AWS", "Python"], "description": "Scale the observability infrastructure behind thousands of enterprise customers."},
    ],
    "linkedin": [
        {"id": "li-1", "title": "Staff Software Engineer", "company": "Figma", "location": "Remote", "remote": True, "salaryMin": 160000, "salaryMax": 220000, "skills": ["TypeScript", "React", "Node.js", "C++"], "description": "Lead the multiplayer editing engine that keeps millions of canvases in sync."},
        {"id": "li-2", "title": "Machine Learning Engineer", "company": "OpenAI", "location": "San Francisco, CA", "remote": False, "salaryMin": 200000, "salaryMax": 300000, "skills": ["Python", "PyTorch", "Kubernetes", "SQL"], "description": "Train and evaluate large models on frontier-scale GPU clusters."},
        {"id": "li-3", "title": "Senior Full-Stack Engineer", "company": "Notion", "location": "Remote", "remote": True, "salaryMin": 140000, "salaryMax": 190000, "skills": ["React", "Node.js", "TypeScript", "PostgreSQL"], "description": "Build collaborative docs features end to end, from data model to pixel."},
        {"id": "li-4", "title": "Data Engineer", "company": "Snowflake", "location": "Remote", "remote": True, "salaryMin": 130000, "salaryMax": 180000, "skills": ["Python", "SQL", "Spark", "Airflow"], "description": "Design pipelines moving petabytes of telemetry into the analytics lakehouse."},
        {"id": "li-5", "title": "Mobile Engineer", "company": "Duolingo", "location": "Pittsburgh, PA", "remote": False, "salaryMin": 110000, "salaryMax": 150000, "skills": ["React Native", "TypeScript", "Swift"], "description": "Craft delightful learning experiences for the world's most-downloaded education app."},
    ],
    "glassdoor": [
        {"id": "gd-1", "title": "Frontend Engineer", "company": "Vercel", "location": "Remote", "remote": True, "salaryMin": 120000, "salaryMax": 170000, "skills": ["Next.js", "React", "TypeScript", "TailwindCSS"], "description": "Improve the developer experience of the Next.js ecosystem and dashboard."},
        {"id": "gd-2", "title": "Platform Engineer", "company": "Cloudflare", "location": "Austin, TX", "remote": False, "salaryMin": 125000, "salaryMax": 165000, "skills": ["Go", "Kubernetes", "Redis", "Rust"], "description": "Operate the edge network serving a significant fraction of internet traffic."},
        {"id": "gd-3", "title": "Full-Stack Engineer", "company": "Linear", "location": "Remote", "remote": True, "salaryMin": 130000, "salaryMax": 180000, "skills": ["TypeScript", "React", "Node.js", "GraphQL"], "description": "Shape the issue-tracking product trusted by high-velocity product teams."},
        {"id": "gd-4", "title": "Site Reliability Engineer", "company": "GitLab", "location": "Remote", "remote": True, "salaryMin": 115000, "salaryMax": 155000, "skills": ["Go", "Terraform", "AWS", "Prometheus"], "description": "Keep an all-remote DevOps platform available across every region."},
    ],
    "ziprecruiter": [
        {"id": "zr-1", "title": "Junior Web Developer", "company": "LocalStack Media", "location": "Chicago, IL", "remote": False, "salaryMin": 55000, "salaryMax": 75000, "skills": ["JavaScript", "HTML", "CSS", "WordPress"], "description": "Maintain and extend marketing sites for regional clients; great growth opportunity."},
        {"id": "zr-2", "title": "QA Automation Engineer", "company": "Testlio", "location": "Remote", "remote": True, "salaryMin": 70000, "salaryMax": 95000, "skills": ["Python", "Selenium", "pytest", "CI/CD"], "description": "Automate regression suites for streaming and fintech clients."},
        {"id": "zr-3", "title": "Backend Developer", "company": "Chime", "location": "Remote", "remote": True, "salaryMin": 110000, "salaryMax": 145000, "skills": ["Node.js", "Java", "AWS", "PostgreSQL"], "description": "Build banking services that millions of members rely on daily."},
        {"id": "zr-4", "title": "Data Analyst", "company": "Spotify", "location": "New York, NY", "remote": False, "salaryMin": 80000, "salaryMax": 105000, "skills": ["SQL", "Python", "Tableau", "dbt"], "description": "Turn listening data into insights that shape editorial and product decisions."},
    ],
    "monster": [
        {"id": "mn-1", "title": "Senior Java Engineer", "company": "JPMorgan Chase", "location": "Columbus, OH", "remote": False, "salaryMin": 115000, "salaryMax": 150000, "skills": ["Java", "Spring Boot", "Kafka", "SQL"], "description": "Modernize core banking pipelines with event-driven architecture."},
        {"id": "mn-2", "title": "Cloud Architect", "company": "Oracle", "location": "Remote", "remote": True, "salaryMin": 150000, "salaryMax": 200000, "skills": ["AWS", "Azure", "Terraform", "Python"], "description": "Design multi-region landing zones for Fortune 500 migrations."},
        {"id": "mn-3", "title": "Frontend Developer", "company": "Atlassian", "location": "Remote", "remote": True, "salaryMin": 120000, "salaryMax": 160000, "skills": ["React", "TypeScript", "Webpack", "Jest"], "description": "Evolve the Jira web client used by over a million teams."},
        {"id": "mn-4", "title": "Security Engineer", "company": "CrowdStrike", "location": "Remote", "remote": True, "salaryMin": 135000, "salaryMax": 180000, "skills": ["Python", "Go", "SIEM", "Kubernetes"], "description": "Hunt threats across endpoint telemetry at global scale."},
    ],
    "naukri": [
        {"id": "nk-1", "title": "Senior Software Engineer", "company": "Infosys", "location": "Bengaluru, India", "remote": False, "salaryMin": 1800000, "salaryMax": 2800000, "skills": ["Java", "Spring Boot", "Microservices", "SQL"], "description": "Deliver enterprise microservices for global banking clients (annual INR salary)."},
        {"id": "nk-2", "title": "Full-Stack Developer", "company": "Zomato", "location": "Gurugram, India", "remote": False, "salaryMin": 2000000, "salaryMax": 3200000, "skills": ["React", "Node.js", "MongoDB", "TypeScript"], "description": "Build customer-facing features for India's largest food-delivery platform."},
        {"id": "nk-3", "title": "DevOps Engineer", "company": "Tata Consultancy Services", "location": "Remote (India)", "remote": True, "salaryMin": 1500000, "salaryMax": 2400000, "skills": ["AWS", "Docker", "Jenkins", "Linux"], "description": "Automate CI/CD for large-scale public-sector cloud deployments."},
        {"id": "nk-4", "title": "Data Scientist", "company": "Flipkart", "location": "Bengaluru, India", "remote": False, "salaryMin": 2200000, "salaryMax": 3500000, "skills": ["Python", "scikit-learn", "SQL", "Pandas"], "description": "Model demand forecasting for the Big Billion Days sale event."},
        {"id": "nk-5", "title": "Frontend Engineer", "company": "Razorpay", "location": "Bengaluru, India", "remote": False, "salaryMin": 1800000, "salaryMax": 3000000, "skills": ["React", "TypeScript", "Redux", "TailwindCSS"], "description": "Craft payment checkout experiences for thousands of Indian merchants."},
    ],
}


def _get_portal_feed(slug: str) -> List[FeedJob]:
    """Build the feed for a portal slug, stamping postedAt dates 1..N days ago."""
    templates = _PORTAL_FEEDS.get(slug.lower())
    if templates is None:
        raise KeyError(slug)
    return [FeedJob(**tpl, postedAt=_posted_ago(index + 1)) for index, tpl in enumerate(templates)]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Liveness probe: service name, version, uptime and current timestamp."""
    return HealthResponse(
        status="ok",
        service=SERVICE_NAME,
        version=SERVICE_VERSION,
        uptime_seconds=round(time.time() - PROCESS_START, 3),
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@app.post("/score-jobs", response_model=ScoreResponse)
async def score_jobs(payload: ScoreRequest) -> ScoreResponse:
    """Score every job in the payload against the profile."""
    return ScoreResponse(results=[score_job(payload.profile, job) for job in payload.jobs])


@app.post("/cover-letter", response_model=CoverLetterResponse)
async def cover_letter(payload: CoverLetterRequest) -> CoverLetterResponse:
    """Generate a professional cover letter tailored to the given job."""
    return CoverLetterResponse(coverLetter=build_cover_letter(payload.profile, payload.job))


@app.post("/automation-cycle", response_model=AutomationResponse)
async def automation_cycle(payload: AutomationRequest) -> AutomationResponse:
    """Run one autonomous application cycle.

    Scores all jobs, sorts by match score (descending), selects jobs scoring at
    least ``config.minMatchScore`` up to ``config.dailyLimit``, and generates a
    cover letter for each selected job when ``config.autoCoverLetter`` is true.
    ``summary.avgMatchScore`` is the mean score of the applied jobs.
    """
    scored = sorted(
        ((job, score_job(payload.profile, job)) for job in payload.jobs),
        key=lambda pair: pair[1].matchScore,
        reverse=True,  # stable: ties keep their original payload order
    )

    applied: List[AppliedJob] = []
    skipped: List[SkippedJob] = []
    for job, result in scored:
        if result.matchScore >= payload.config.minMatchScore and len(applied) < payload.config.dailyLimit:
            letter = build_cover_letter(payload.profile, job) if payload.config.autoCoverLetter else None
            applied.append(
                AppliedJob(jobId=job.id, matchScore=result.matchScore, coverLetter=letter, reasons=result.reasons)
            )
        elif result.matchScore < payload.config.minMatchScore:
            skipped.append(
                SkippedJob(
                    jobId=job.id,
                    matchScore=result.matchScore,
                    reason=f"below min match score ({payload.config.minMatchScore})",
                )
            )
        else:
            skipped.append(
                SkippedJob(
                    jobId=job.id,
                    matchScore=result.matchScore,
                    reason=f"daily limit reached ({payload.config.dailyLimit})",
                )
            )

    avg = round(sum(item.matchScore for item in applied) / len(applied), 1) if applied else 0.0
    summary = AutomationSummary(
        total=len(payload.jobs),
        applied=len(applied),
        skipped=len(skipped),
        avgMatchScore=avg,
    )
    return AutomationResponse(applied=applied, skipped=skipped, summary=summary)


@app.get("/portal-feed/{slug}", response_model=PortalFeedResponse)
async def portal_feed(slug: str) -> PortalFeedResponse:
    """Return a mock job feed for a supported portal slug (else 404)."""
    try:
        jobs = _get_portal_feed(slug)
    except KeyError:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown portal '{slug}'. Supported portals: {', '.join(sorted(_PORTAL_FEEDS))}",
        ) from None
    return PortalFeedResponse(portal=slug.lower(), jobs=jobs)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
