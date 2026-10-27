import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const q = (sp.get('q') ?? '').toLowerCase().trim()
    const portal = sp.get('portal') ?? 'all'
    const location = sp.get('location') ?? 'all'
    const remote = sp.get('remote') === 'true'
    const minMatch = Number(sp.get('minMatch') ?? 0)
    const minSalary = Number(sp.get('minSalary') ?? 0)
    const status = sp.get('status') ?? 'all'
    const sort = sp.get('sort') ?? 'match'

    const rows = await db.job.findMany({ include: { portal: { select: { name: true, slug: true } } } })

    let jobs = rows.filter((job) => {
      if (q && !`${job.title} ${job.company} ${job.description ?? ''}`.toLowerCase().includes(q)) return false
      if (portal !== 'all' && job.portal?.slug !== portal) return false
      if (location !== 'all' && job.location !== location) return false
      if (remote && !job.remote) return false
      if (minMatch && job.matchScore < minMatch) return false
      if (minSalary && (job.salaryMax ?? 0) < minSalary) return false
      if (status !== 'all' && job.status !== status) return false
      return true
    })

    if (sort === 'match') jobs = jobs.sort((a, b) => b.matchScore - a.matchScore)
    else if (sort === 'recent') jobs = jobs.sort((a, b) => (b.postedAt?.getTime() ?? 0) - (a.postedAt?.getTime() ?? 0))
    else if (sort === 'salary') jobs = jobs.sort((a, b) => (b.salaryMax ?? 0) - (a.salaryMax ?? 0))

    const locations = [...new Set(rows.map((r) => r.location))].sort()
    const portalNames = [...new Set(rows.map((r) => r.portal?.name).filter(Boolean))] as string[]

    return NextResponse.json({
      jobs: jobs.slice(0, 200).map((job) => ({
        id: job.id, portalId: job.portalId, portalName: job.portal?.name ?? 'Web', portalSlug: job.portal?.slug ?? 'web',
        title: job.title, company: job.company, location: job.location, remote: job.remote,
        employmentType: job.employmentType, salaryMin: job.salaryMin, salaryMax: job.salaryMax,
        description: job.description ?? '', skills: JSON.parse(job.skills), easyApply: job.easyApply,
        postedAt: job.postedAt?.toISOString() ?? null, matchScore: job.matchScore, saved: job.saved, status: job.status,
      })),
      facets: { locations, portals: portalNames },
      total: jobs.length,
    })
  } catch (e) {
    console.error('[jobs GET]', e)
    return NextResponse.json({ error: 'Failed to load jobs' }, { status: 500 })
  }
}
