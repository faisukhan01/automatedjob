import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [jobs, applicationsRaw, portals, recent, config] = await Promise.all([
      db.job.findMany({ include: { portal: { select: { name: true, slug: true } } } }),
      db.application.findMany({
        include: { job: { include: { portal: { select: { name: true, slug: true } } } } },
        orderBy: { appliedAt: 'desc' },
      }),
      db.portal.findMany(),
      db.activityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
      db.automationConfig.findUnique({ where: { id: 'main' } }),
    ])

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const autoToday = applicationsRaw.filter(
      (a) => a.method === 'auto' && a.appliedAt >= startOfToday
    ).length

    const byStatusMap = new Map<string, number>()
    for (const a of applicationsRaw) byStatusMap.set(a.status, (byStatusMap.get(a.status) ?? 0) + 1)
    const byStatus = [...byStatusMap.entries()].map(([status, count]) => ({ status, count }))

    const byPortalMap = new Map<string, { name: string; slug: string; count: number }>()
    for (const a of applicationsRaw) {
      const p = a.job.portal
      if (!p) continue
      const cur = byPortalMap.get(p.slug) ?? { name: p.name, slug: p.slug, count: 0 }
      cur.count++
      byPortalMap.set(p.slug, cur)
    }
    const byPortal = [...byPortalMap.values()].sort((a, b) => b.count - a.count)

    // 14-day series
    const series: { date: string; label: string; count: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const day = new Date()
      day.setHours(0, 0, 0, 0)
      day.setDate(day.getDate() - i)
      const next = new Date(day)
      next.setDate(next.getDate() + 1)
      const count = applicationsRaw.filter((a) => a.appliedAt >= day && a.appliedAt < next).length
      series.push({
        date: day.toISOString().slice(0, 10),
        label: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count,
      })
    }

    const positive = ['screening', 'interview', 'offer'].reduce((s, k) => s + (byStatusMap.get(k) ?? 0), 0)
    const responseRate = applicationsRaw.length ? Math.round((positive / applicationsRaw.length) * 1000) / 10 : 0

    const topMatches = jobs
      .filter((job) => job.status === 'new')
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 4)
      .map((job) => ({
        id: job.id,
        portalId: job.portalId,
        portalName: job.portal?.name ?? 'Web',
        portalSlug: job.portal?.slug ?? 'web',
        title: job.title,
        company: job.company,
        location: job.location,
        remote: job.remote,
        employmentType: job.employmentType,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        description: job.description ?? '',
        skills: JSON.parse(job.skills),
        easyApply: job.easyApply,
        postedAt: job.postedAt?.toISOString() ?? null,
        matchScore: job.matchScore,
        saved: job.saved,
        status: job.status,
      }))

    return NextResponse.json({
      totals: {
        jobs: jobs.length,
        newJobs: jobs.filter((job) => job.status === 'new').length,
        applications: applicationsRaw.length,
        connectedPortals: portals.filter((p) => p.status === 'connected').length,
        interviews: byStatusMap.get('interview') ?? 0,
        offers: byStatusMap.get('offer') ?? 0,
        autoToday,
        dailyLimit: config?.dailyLimit ?? 20,
      },
      engineEnabled: config?.enabled ?? false,
      responseRate,
      byStatus,
      byPortal,
      series,
      recent: recent.map((l) => ({
        id: l.id,
        type: l.type,
        title: l.title,
        detail: l.detail,
        portalSlug: l.portalSlug,
        createdAt: l.createdAt.toISOString(),
      })),
      topMatches,
    })
  } catch (e) {
    console.error('[overview]', e)
    return NextResponse.json({ error: 'Failed to load overview' }, { status: 500 })
  }
}
