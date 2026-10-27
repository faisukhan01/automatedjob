import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { engineHealth, enginePost } from '@/lib/engine'
import { scoreJob, generateCoverLetter } from '@/lib/matching'

export const dynamic = 'force-dynamic'

export async function GET() {
  const health = await engineHealth()
  return NextResponse.json({
    ok: !!health,
    service: health?.service ?? 'unreachable',
    version: health?.version ?? null,
    uptimeSeconds: health?.uptime_seconds ?? null,
    mode: health ? 'fastapi' : 'fallback',
  })
}

export async function POST() {
  try {
    const config = await db.automationConfig.findUnique({ where: { id: 'main' } })
    if (!config) return NextResponse.json({ error: 'Config missing' }, { status: 500 })
    if (!config.enabled) {
      return NextResponse.json({ error: 'Auto-pilot is paused — enable the engine first' }, { status: 400 })
    }

    const profile = await db.profile.findFirst()
    if (!profile) return NextResponse.json({ error: 'Complete your profile first' }, { status: 400 })

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const autoToday = await db.application.count({ where: { method: 'auto', appliedAt: { gte: startOfToday } } })
    const remaining = config.dailyLimit - autoToday
    if (remaining <= 0) {
      return NextResponse.json({ error: `Daily limit reached (${config.dailyLimit}). Resets tomorrow.` }, { status: 400 })
    }

    const openJobs = await db.job.findMany({
      where: { status: { in: ['new', 'saved'] } },
      include: { portal: { select: { name: true, slug: true } } },
    })
    if (!openJobs.length) {
      return NextResponse.json({ error: 'No open jobs to apply to — sync a portal to discover new roles' }, { status: 400 })
    }

    const profilePayload = {
      fullName: profile.fullName, email: profile.email, headline: profile.headline,
      yearsExperience: profile.yearsExperience, minSalary: profile.minSalary, remoteOnly: profile.remoteOnly,
      skills: JSON.parse(profile.skills), desiredRoles: JSON.parse(profile.desiredRoles),
      desiredLocations: JSON.parse(profile.desiredLocations),
    }
    const jobsPayload = openJobs.map((job) => ({
      id: job.id, title: job.title, company: job.company, location: job.location, remote: job.remote,
      salaryMin: job.salaryMin, salaryMax: job.salaryMax, skills: JSON.parse(job.skills),
      description: job.description,
    }))

    type CycleResult = {
      applied: { jobId: string; matchScore: number; coverLetter: string | null; reasons: string[] }[]
      skipped: { jobId: string; matchScore: number; reason: string }[]
      summary: { total: number; applied: number; skipped: number; avgMatchScore: number }
    }

    let result: CycleResult | null = await enginePost<CycleResult>('/automation-cycle', {
      profile: profilePayload,
      config: { dailyLimit: remaining, minMatchScore: config.minMatchScore, autoCoverLetter: config.autoCoverLetter },
      jobs: jobsPayload,
    })
    let engine: 'fastapi' | 'fallback' = 'fastapi'

    // Local fallback (mirrors the FastAPI algorithm) if the engine is unreachable
    if (!result) {
      engine = 'fallback'
      const scored = jobsPayload.map((job) => ({ job, ...scoreJob(profilePayload, job) }))
        .sort((a, b) => b.score - a.score)
      const selected = scored.filter((s) => s.score >= config.minMatchScore).slice(0, remaining)
      const below = scored.filter((s) => s.score < config.minMatchScore)
      const overLimit = scored.filter((s) => s.score >= config.minMatchScore).slice(remaining)
      result = {
        applied: selected.map((s) => ({
          jobId: s.job.id, matchScore: s.score,
          coverLetter: config.autoCoverLetter ? generateCoverLetter(profilePayload, s.job) : null,
          reasons: s.reasons,
        })),
        skipped: [
          ...below.map((s) => ({ jobId: s.job.id, matchScore: s.score, reason: `below min match score (${config.minMatchScore})` })),
          ...overLimit.map((s) => ({ jobId: s.job.id, matchScore: s.score, reason: 'daily limit reached' })),
        ],
        summary: {
          total: jobsPayload.length, applied: selected.length,
          skipped: below.length + overLimit.length,
          avgMatchScore: selected.length ? Math.round(selected.reduce((acc, s) => acc + s.score, 0) / selected.length) : 0,
        },
      }
    }

    const now = new Date()
    const details: { jobId: string; title: string; company: string; matchScore: number }[] = []
    let savedCount = 0

    for (const item of result.applied) {
      const job = openJobs.find((j) => j.id === item.jobId)
      if (!job) continue
      const already = await db.application.findFirst({ where: { jobId: job.id } })
      if (already) continue

      const coverLetter = item.coverLetter ?? generateCoverLetter(profilePayload, {
        title: job.title, company: job.company, skills: JSON.parse(job.skills),
      })
      await db.application.create({
        data: {
          jobId: job.id, status: 'applied', method: 'auto', coverLetter,
          matchScore: item.matchScore,
          events: JSON.stringify([{ at: now.toISOString(), label: `Application submitted via auto-pilot on ${job.portal?.name ?? 'portal'}` }]),
          appliedAt: now,
        },
      })
      await db.job.update({ where: { id: job.id }, data: { status: 'applied' } })
      if (job.portalId) await db.portal.update({ where: { id: job.portalId }, data: { applicationsCount: { increment: 1 } } })
      details.push({ jobId: job.id, title: job.title, company: job.company, matchScore: item.matchScore })
    }

    if (config.autoSaveJobs) {
      for (const item of result.skipped) {
        if (/limit/i.test(item.reason)) {
          const job = openJobs.find((j) => j.id === item.jobId)
          if (job && job.status === 'new') {
            await db.job.update({ where: { id: job.id }, data: { saved: true } })
            savedCount++
          }
        }
      }
    }

    await db.activityLog.create({
      data: {
        type: 'engine_run',
        title: 'Auto-pilot cycle completed',
        detail: `${details.length ? `Applied to ${details.length} new job${details.length === 1 ? '' : 's'}` : 'No new applications'}${savedCount ? ` · ${savedCount} saved` : ''} · ${result.skipped.length} skipped · via ${engine === 'fastapi' ? 'FastAPI engine' : 'local fallback'}`,
        meta: JSON.stringify({ applied: details.length, saved: savedCount, skipped: result.skipped.length, engine }),
      },
    })
    for (const d of details.slice(0, 6)) {
      await db.activityLog.create({
        data: {
          type: 'application_sent',
          title: 'Application sent via auto-pilot',
          detail: `${d.title} — ${d.company} · ${d.matchScore}% match`,
          meta: JSON.stringify({ matchScore: d.matchScore, jobId: d.jobId }),
        },
      })
    }

    return NextResponse.json({
      ok: true,
      applied: details,
      saved: savedCount,
      skipped: result.skipped.length,
      engine,
      message: details.length
        ? `Applied to ${details.length} job${details.length === 1 ? '' : 's'} (${engine === 'fastapi' ? 'FastAPI engine' : 'local fallback'})`
        : 'No jobs passed your match threshold this cycle',
    })
  } catch (e) {
    console.error('[engine POST]', e)
    return NextResponse.json({ error: 'Engine run failed' }, { status: 500 })
  }
}
