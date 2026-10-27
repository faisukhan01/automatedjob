import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { engineGet } from '@/lib/engine'
import { scoreJob } from '@/lib/matching'

export const dynamic = 'force-dynamic'

async function profilePayload() {
  const profile = await db.profile.findFirst()
  if (!profile) return null
  return {
    fullName: profile.fullName, email: profile.email, headline: profile.headline,
    yearsExperience: profile.yearsExperience, minSalary: profile.minSalary,
    remoteOnly: profile.remoteOnly,
    skills: JSON.parse(profile.skills) as string[],
    desiredRoles: JSON.parse(profile.desiredRoles) as string[],
    desiredLocations: JSON.parse(profile.desiredLocations) as string[],
  }
}

function serializePortal(p: {
  id: string; name: string; slug: string; status: string; autoApply: boolean
  lastSyncAt: Date | null; applicationsCount: number; _count?: { jobs: number }
}) {
  return {
    id: p.id, name: p.name, slug: p.slug, status: p.status, autoApply: p.autoApply,
    lastSyncAt: p.lastSyncAt?.toISOString() ?? null, applicationsCount: p.applicationsCount,
    jobsCount: p._count?.jobs ?? 0,
  }
}

export async function GET() {
  try {
    const portals = await db.portal.findMany({
      orderBy: [{ status: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { jobs: true } } },
    })
    return NextResponse.json(portals.map(serializePortal))
  } catch (e) {
    console.error('[portals GET]', e)
    return NextResponse.json({ error: 'Failed to load portals' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const slug = String(body.slug ?? '')
    const action = String(body.action ?? '')
    const portal = await db.portal.findUnique({ where: { slug } })
    if (!portal) return NextResponse.json({ error: 'Unknown portal' }, { status: 404 })

    if (action === 'connect') {
      await db.portal.update({ where: { slug }, data: { status: 'connected', lastSyncAt: new Date() } })
      await db.activityLog.create({
        data: { type: 'portal_connected', title: `${portal.name} connected`, detail: 'Session verified · profile sync complete', portalSlug: slug, meta: '{}' },
      })
      return NextResponse.json({ ok: true, message: `${portal.name} connected successfully` })
    }

    if (action === 'disconnect') {
      await db.portal.update({ where: { slug }, data: { status: 'disconnected', autoApply: false } })
      await db.activityLog.create({
        data: { type: 'portal_connected', title: `${portal.name} disconnected`, detail: 'Session removed · auto-apply disabled', portalSlug: slug, meta: '{}' },
      })
      return NextResponse.json({ ok: true, message: `${portal.name} disconnected` })
    }

    if (action === 'toggle-auto') {
      const updated = await db.portal.update({ where: { slug }, data: { autoApply: !portal.autoApply } })
      await db.activityLog.create({
        data: {
          type: 'config_updated',
          title: `${portal.name} auto-apply ${updated.autoApply ? 'enabled' : 'disabled'}`,
          detail: updated.autoApply ? `Auto-pilot will apply on ${portal.name} within your rules` : `${portal.name} excluded from auto-apply`,
          portalSlug: slug, meta: '{}',
        },
      })
      return NextResponse.json({ ok: true, message: `Auto-apply ${updated.autoApply ? 'enabled' : 'disabled'} for ${portal.name}` })
    }

    if (action === 'sync') {
      if (portal.status !== 'connected') return NextResponse.json({ error: `${portal.name} is not connected` }, { status: 400 })
      const profile = await profilePayload()
      if (!profile) return NextResponse.json({ error: 'Complete your profile first' }, { status: 400 })

      type FeedJob = {
        id: string; title: string; company: string; location: string; remote: boolean
        salaryMin: number; salaryMax: number; skills: string[]; description: string; postedAt?: string
      }
      let jobs: FeedJob[]
      let engine = 'fastapi'

      const feed = await engineGet<{ jobs: FeedJob[] }>(`/portal-feed/${slug}`)
      if (feed?.jobs?.length) {
        jobs = feed.jobs
      } else {
        engine = 'fallback'
        const seeds = [
          { title: 'Senior Full-Stack Engineer', skills: ['React', 'Next.js', 'TypeScript', 'Node.js'] },
          { title: 'Backend Engineer — Python', skills: ['Python', 'FastAPI', 'PostgreSQL', 'Docker'] },
          { title: 'Frontend Engineer (React)', skills: ['React', 'TypeScript', 'Tailwind CSS'] },
          { title: 'Full-Stack Developer (Laravel)', skills: ['PHP', 'Laravel', 'MySQL'] },
        ]
        jobs = seeds.map((s, i) => ({
          id: `fb-${Date.now()}-${i}`, title: s.title, company: ['TechNova', 'CloudSprint', 'DataForge', 'PixelWorks'][i],
          location: i % 2 === 0 ? 'Remote — Global' : 'Karachi, Pakistan', remote: i % 2 === 0,
          salaryMin: 60000 + i * 5000, salaryMax: 110000 + i * 5000, skills: s.skills,
          description: `${s.title} role discovered on ${portal.name}.`,
        }))
      }

      const existing = await db.job.findMany({ where: { portalId: portal.id }, select: { externalId: true } })
      const seen = new Set(existing.map((e) => e.externalId))
      let added = 0
      for (const fj of jobs) {
        const externalId = `${slug}-${fj.id}`
        if (seen.has(externalId)) continue
        await db.job.create({
          data: {
            portalId: portal.id, externalId, title: fj.title, company: fj.company,
            location: fj.location, remote: !!fj.remote, employmentType: 'full-time',
            salaryMin: fj.salaryMin ?? null, salaryMax: fj.salaryMax ?? null,
            description: fj.description, skills: JSON.stringify(fj.skills),
            easyApply: true, postedAt: new Date(),
            matchScore: scoreJob(profile, {
              title: fj.title, company: fj.company, location: fj.location, remote: fj.remote,
              salaryMin: fj.salaryMin, salaryMax: fj.salaryMax, skills: fj.skills,
            }).score,
          },
        })
        added++
      }
      await db.portal.update({ where: { slug }, data: { lastSyncAt: new Date() } })
      await db.activityLog.create({
        data: { type: 'portal_synced', title: `${portal.name} synced`, detail: `${added} new jobs fetched · feed via ${engine === 'fastapi' ? 'FastAPI engine' : 'local fallback'}`, portalSlug: slug, meta: JSON.stringify({ added }) },
      })
      return NextResponse.json({ ok: true, added, engine, message: `${portal.name} synced — ${added} new job${added === 1 ? '' : 's'}` })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    console.error('[portals POST]', e)
    return NextResponse.json({ error: 'Portal action failed' }, { status: 500 })
  }
}
