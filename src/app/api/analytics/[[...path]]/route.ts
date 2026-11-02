import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// JobPilot AI — Analytics gateway
//
// Mirrors the Laravel 11 analytics microservice contract (mini-services/analytics-api,
// port 8002): /health, /analytics/summary, /analytics/funnel, /analytics/portals.
//
// Resolution order:
//   1. Laravel microservice (production path — PHP-FPM/Octane deployment)
//   2. Local computation over the live Prisma database (sandbox / fallback path,
//      so the Insights view is always testable with real platform data)

export const dynamic = 'force-dynamic'

const LARAVEL_URL = process.env.ANALYTICS_URL || 'http://localhost:8002'

type Window = { from: string; to: string; days: number }

const PROGRESS = ['screening', 'interview', 'offer']
const INTERVIEWS = ['interview', 'offer']

const rate = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0)

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

function resolveWindow(sp: URLSearchParams): Window {
  const to = sp.get('to') ? new Date(`${sp.get('to')}T23:59:59Z`) : new Date()
  let from = sp.get('from') ? new Date(`${sp.get('from')}T00:00:00Z`) : null
  if (!from) {
    from = new Date(to)
    from.setDate(from.getDate() - 13)
  }
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1)
  return { from: dayKey(from), to: dayKey(to), days }
}

async function laravelGet(path: string, timeoutMs = 1500): Promise<unknown | null> {
  try {
    const res = await fetch(`${LARAVEL_URL}${path}`, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

type AppRow = {
  status: string
  appliedAt: Date
  portalSlug: string | null
  portalName: string | null
}

async function collectApps(win: Window, portal: string | null): Promise<AppRow[]> {
  const apps = await db.application.findMany({
    where: {
      appliedAt: { gte: new Date(`${win.from}T00:00:00.000Z`), lte: new Date(`${win.to}T23:59:59.999Z`) },
    },
    include: { job: { include: { portal: { select: { slug: true, name: true } } } } },
    orderBy: { appliedAt: 'asc' },
  })
  return apps
    .map((a) => ({
      status: a.status,
      appliedAt: a.appliedAt,
      portalSlug: a.job?.portal?.slug ?? 'company',
      portalName: a.job?.portal?.name ?? 'Company Site',
    }))
    .filter((a) => (portal && portal !== 'all' ? a.portalSlug === portal : true))
}

function emptyStat() {
  return { applications: 0, interviews: 0, offers: 0, responses: 0 }
}

function aggregate(apps: AppRow[], win: Window, portalLabel: Record<string, string>) {
  const totals = emptyStat()
  const perPortal = new Map<string, ReturnType<typeof emptyStat>>()
  const perDay = new Map<string, ReturnType<typeof emptyStat>>()
  for (let i = 0; i < win.days; i++) {
    const d = new Date(`${win.from}T00:00:00.000Z`)
    d.setDate(d.getDate() + i)
    perDay.set(dayKey(d), emptyStat())
  }
  const funnel = { applied: 0, screening: 0, interview: 0, offer: 0 }

  for (const a of apps) {
    const key = dayKey(a.appliedAt)
    if (!perPortal.has(a.portalSlug!)) perPortal.set(a.portalSlug!, emptyStat())
    if (!perDay.has(key)) perDay.set(key, emptyStat())
    const day = perDay.get(key)!
    const po = perPortal.get(a.portalSlug!)!

    totals.applications++
    day.applications++
    po.applications++
    funnel.applied++

    if (INTERVIEWS.includes(a.status)) {
      totals.interviews++; day.interviews++; po.interviews++
      funnel.screening++; funnel.interview++
    }
    if (a.status === 'offer') {
      totals.offers++; day.offers++; po.offers++
      funnel.offer++
    }
    if (PROGRESS.includes(a.status)) {
      totals.responses++; day.responses++; po.responses++
      if (a.status === 'screening') funnel.screening++
    }
  }

  const byPortal = [...perPortal.entries()]
    .map(([portal, s]) => ({
      portal,
      label: portalLabel[portal] ?? portal,
      applications: s.applications,
      interviews: s.interviews,
      offers: s.offers,
      responseRate: rate(s.responses, s.applications),
      interviewRate: rate(s.interviews, s.applications),
    }))
    .sort((x, y) => y.applications - x.applications)

  const byDay = [...perDay.entries()]
    .sort((x, y) => (x[0] < y[0] ? -1 : 1))
    .map(([date, s]) => ({
      date,
      applications: s.applications,
      interviews: s.interviews,
      offers: s.offers,
      responseRate: rate(s.responses, s.applications),
    }))

  return { totals: { ...totals, responseRate: rate(totals.responses, totals.applications) }, byPortal, byDay, funnel }
}

function portalLabelsFrom(rows: AppRow[]): Record<string, string> {
  const map: Record<string, string> = { company: 'Company Site', referral: 'Referral' }
  for (const r of rows) if (r.portalSlug && r.portalName) map[r.portalSlug] = r.portalName
  return map
}

// GET /api/analytics/health|summary|funnel|portals
export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params
  const seg = path.join('/')
  const sp = req.nextUrl.searchParams

  // ---- health ------------------------------------------------------------
  if (seg === 'health' || seg === '') {
    const laravel = await laravelGet('/api/health')
    if (laravel) return NextResponse.json({ ok: true, service: 'laravel-microservice', upstream: laravel })
    try {
      await db.portal.count()
      return NextResponse.json({ ok: true, service: 'nextjs-prisma-fallback', upstream: null })
    } catch {
      return NextResponse.json({ ok: false, service: 'unavailable' }, { status: 503 })
    }
  }

  const remote = await laravelGet(`/api/analytics/${seg}?${sp.toString()}`)
  const source = remote ? 'laravel-microservice' : 'nextjs-prisma-fallback'
  const data = remote ?? (await computeLocal(seg, sp))
  if (!data) return NextResponse.json({ error: 'Unknown analytics endpoint' }, { status: 404 })
  return NextResponse.json({ ...(data as object), source })
}

async function computeLocal(seg: string, sp: URLSearchParams): Promise<unknown | null> {
  const win = resolveWindow(sp)
  const portal = sp.get('portal')
  const apps = await collectApps(win, portal)
  const labels = portalLabelsFrom(apps)

  if (seg === 'summary') {
    const agg = aggregate(apps, win, labels)
    return {
      window: win,
      portal: portal && portal !== 'all' ? portal : null,
      totals: agg.totals,
      byPortal: agg.byPortal,
      byDay: agg.byDay,
      funnel: agg.funnel,
    }
  }

  if (seg === 'funnel') {
    const { funnel } = aggregate(apps, win, labels)
    const stages: { stage: string; count: number; percentage: number; conversionFromPrevious: number | null }[] = []
    let prev: number | null = null
    for (const [stage, count] of Object.entries(funnel)) {
      stages.push({
        stage,
        count,
        percentage: rate(count, funnel.applied),
        conversionFromPrevious: prev !== null && prev > 0 ? rate(count, prev) : null,
      })
      prev = count
    }
    return { window: win, portal: portal && portal !== 'all' ? portal : null, stages }
  }

  if (seg === 'portals') {
    const all = await collectApps(win, null)
    const allLabels = portalLabelsFrom(all)
    const agg = aggregate(all, win, allLabels)
    const best = agg.byPortal
      .filter((p) => p.applications > 0)
      .sort((x, y) => y.responseRate - x.responseRate)[0] ?? null
    return {
      window: win,
      totals: agg.totals,
      portals: agg.byPortal,
      bestPortal: best
        ? { portal: best.portal, label: best.label, responseRate: best.responseRate, applications: best.applications }
        : null,
    }
  }

  return null
}
