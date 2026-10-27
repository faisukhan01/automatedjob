import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { enginePost } from '@/lib/engine'
import { generateCoverLetter } from '@/lib/matching'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get('status') ?? 'all'
    const rows = await db.application.findMany({
      include: { job: { include: { portal: { select: { name: true, slug: true } } } } },
      orderBy: { appliedAt: 'desc' },
    })
    const apps = rows.filter((a) => status === 'all' || a.status === status)
    return NextResponse.json({
      applications: apps.map((a) => ({
        id: a.id, jobId: a.jobId, status: a.status, method: a.method,
        coverLetter: a.coverLetter, matchScore: a.matchScore,
        events: JSON.parse(a.events), appliedAt: a.appliedAt.toISOString(),
        job: {
          id: a.job.id, title: a.job.title, company: a.job.company, location: a.job.location,
          remote: a.job.remote, employmentType: a.job.employmentType,
          salaryMin: a.job.salaryMin, salaryMax: a.job.salaryMax,
          portalName: a.job.portal?.name ?? 'Web', portalSlug: a.job.portal?.slug ?? 'web',
          matchScore: a.matchScore, skills: JSON.parse(a.job.skills),
        },
      })),
    })
  } catch (e) {
    console.error('[applications GET]', e)
    return NextResponse.json({ error: 'Failed to load applications' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const jobId = String(body.jobId ?? '')
    const method = body.method === 'auto' ? 'auto' : 'manual'

    const job = await db.job.findUnique({ where: { id: jobId }, include: { portal: true } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    const existing = await db.application.findFirst({ where: { jobId } })
    if (existing) return NextResponse.json({ error: 'You already applied to this job' }, { status: 409 })

    const profile = await db.profile.findFirst()
    if (!profile) return NextResponse.json({ error: 'Complete your profile first' }, { status: 400 })
    const primaryResume = await db.resume.findFirst({ where: { isPrimary: true } })

    const profilePayload = {
      fullName: profile.fullName, email: profile.email, headline: profile.headline,
      yearsExperience: profile.yearsExperience, minSalary: profile.minSalary, remoteOnly: profile.remoteOnly,
      skills: JSON.parse(profile.skills), desiredRoles: JSON.parse(profile.desiredRoles),
      desiredLocations: JSON.parse(profile.desiredLocations),
    }
    const jobPayload = {
      title: job.title, company: job.company, location: job.location, remote: job.remote,
      salaryMin: job.salaryMin, salaryMax: job.salaryMax, skills: JSON.parse(job.skills),
    }

    const letterRes = await enginePost<{ coverLetter: string }>('/cover-letter', { profile: profilePayload, job: jobPayload })
    const coverLetter = letterRes?.coverLetter ?? generateCoverLetter(profilePayload, jobPayload)
    const engine = letterRes ? 'fastapi' : 'fallback'

    const now = new Date()
    const application = await db.application.create({
      data: {
        jobId, resumeId: primaryResume?.id ?? null, status: 'applied', method,
        coverLetter, matchScore: job.matchScore,
        events: JSON.stringify([{ at: now.toISOString(), label: method === 'auto' ? 'Application submitted via auto-pilot' : 'Application submitted manually' }]),
        appliedAt: now,
      },
    })
    await db.job.update({ where: { id: jobId }, data: { status: 'applied' } })
    if (job.portalId) {
      await db.portal.update({ where: { id: job.portalId }, data: { applicationsCount: { increment: 1 } } })
    }
    await db.activityLog.create({
      data: {
        type: 'application_sent',
        title: `Application sent ${method === 'auto' ? 'via auto-pilot' : 'manually'}`,
        detail: `${job.title} — ${job.company} · ${job.matchScore}% match · cover letter by ${engine === 'fastapi' ? 'FastAPI engine' : 'local generator'}`,
        portalSlug: job.portal?.slug ?? null, meta: JSON.stringify({ matchScore: job.matchScore, jobId }),
      },
    })

    return NextResponse.json({
      ok: true,
      id: application.id,
      engine,
      message: `Applied to ${job.title} at ${job.company}`,
    })
  } catch (e) {
    console.error('[applications POST]', e)
    return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 })
  }
}
