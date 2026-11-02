'use client'

import { useMemo, useState } from 'react'
import {
  useAnalyticsSummary, useAnalyticsFunnel, useAnalyticsPortals, useAnalyticsHealth,
  type AnalyticsWindow,
} from '@/lib/api'
import { usePortals } from '@/lib/api'
import { StatCard } from '@/components/jobpilot/shared/stat-card'
import { SectionHeader } from '@/components/jobpilot/shared/section-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Trophy, Send, MessagesSquare, PartyPopper, Percent, ServerCog, Layers } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer } from 'recharts'

const WINDOWS: { id: string; label: string; days: number }[] = [
  { id: '7d', label: 'Last 7 days', days: 7 },
  { id: '14d', label: 'Last 14 days', days: 14 },
  { id: '30d', label: 'Last 30 days', days: 30 },
  { id: '90d', label: 'Last 90 days', days: 90 },
]

function makeWindow(days: number): AnalyticsWindow {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - (days - 1))
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { from: fmt(from), to: fmt(to), days }
}

const STAGE_TINT: Record<string, string> = {
  applied: 'bg-zinc-400',
  screening: 'bg-amber-500',
  interview: 'bg-violet-500',
  offer: 'bg-emerald-500',
}

function FunnelBars({ stages }: { stages: { stage: string; count: number; percentage: number; conversionFromPrevious: number | null }[] }) {
  const max = Math.max(...stages.map((s) => s.count), 1)
  return (
    <div className="space-y-4">
      {stages.map((s) => (
        <div key={s.stage}>
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="font-medium capitalize">{s.stage}</span>
            <span className="tabular-nums text-muted-foreground">
              {s.count} <span className="text-xs">· {s.percentage}%</span>
              {s.conversionFromPrevious !== null ? (
                <span className="ml-2 text-xs text-primary">{s.conversionFromPrevious}% step</span>
              ) : null}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${STAGE_TINT[s.stage] ?? 'bg-zinc-400'} transition-all duration-700`}
              style={{ width: `${Math.max((s.count / max) * 100, s.count > 0 ? 3 : 0)}%` }}
              role="progressbar"
              aria-valuenow={s.count}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-label={`${s.stage} stage`}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function InsightsView() {
  const [winId, setWinId] = useState('14d')
  const [portal, setPortal] = useState('all')
  const win = useMemo(() => makeWindow(WINDOWS.find((w) => w.id === winId)?.days ?? 14), [winId])

  const { data: portals } = usePortals()
  const { data: health } = useAnalyticsHealth()
  const summary = useAnalyticsSummary(win, portal)
  const funnel = useAnalyticsFunnel(win, portal)
  const portalPerf = useAnalyticsPortals(win)

  const loading = summary.isLoading || funnel.isLoading || portalPerf.isLoading
  const s = summary.data
  const f = funnel.data
  const p = portalPerf.data

  const chartData = (s?.byDay ?? []).map((d) => ({
    ...d,
    label: new Date(`${d.date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }))

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <SectionHeader
          title="Performance Insights"
          description="Conversion funnel, response rates and portal ROI — served by the Laravel analytics microservice with a live Prisma fallback."
        >
          <Badge
            variant="outline"
            className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            title={health ? `Service: ${health.service}` : undefined}
          >
            <ServerCog className="size-3.5" />
            {health?.service === 'laravel-microservice' ? 'Laravel API' : 'Prisma fallback'}
          </Badge>
          <Select value={winId} onValueChange={setWinId}>
            <SelectTrigger className="h-9 w-[140px]" aria-label="Date range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOWS.map((w) => (
                <SelectItem key={w.id} value={w.id}>{w.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={portal} onValueChange={setPortal}>
            <SelectTrigger className="h-9 w-[160px]" aria-label="Portal filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All portals</SelectItem>
              {(portals ?? []).map((pt) => (
                <SelectItem key={pt.slug} value={pt.slug}>{pt.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SectionHeader>

        {loading || !s || !f || !p ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
            <div className="grid gap-4 lg:grid-cols-5">
              <Skeleton className="h-80 rounded-xl lg:col-span-3" />
              <Skeleton className="h-80 rounded-xl lg:col-span-2" />
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Applications sent" value={s.totals.applications} sub={`${win.days}-day window`} icon={Send} accent="violet" />
              <StatCard title="Interviews reached" value={s.totals.interviews} sub={`${f.stages[2]?.percentage ?? 0}% of applications`} icon={MessagesSquare} accent="amber" />
              <StatCard title="Offers received" value={s.totals.offers} sub={`${f.stages[3]?.percentage ?? 0}% of applications`} icon={PartyPopper} accent="emerald" />
              <StatCard title="Response rate" value={s.totals.responseRate} suffix="%" sub="screening+ replies vs sent" icon={Percent} accent="rose" />
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
              <Card className="bg-card/70 backdrop-blur lg:col-span-3">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Application velocity</CardTitle>
                  <CardDescription>Daily sends, interviews and offers across the selected window</CardDescription>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gSent" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="gInterview" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <RTooltip
                        contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }}
                        labelStyle={{ fontWeight: 600 }}
                      />
                      <Area type="monotone" dataKey="applications" name="Applications" stroke="#8b5cf6" strokeWidth={2} fill="url(#gSent)" />
                      <Area type="monotone" dataKey="interviews" name="Interviews" stroke="#f59e0b" strokeWidth={2} fill="url(#gInterview)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-card/70 backdrop-blur lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base"><Layers className="size-4 text-primary" /> Conversion funnel</CardTitle>
                  <CardDescription>Stage-by-stage progress of every application</CardDescription>
                </CardHeader>
                <CardContent>
                  <FunnelBars stages={f.stages} />
                </CardContent>
              </Card>
            </div>

            <Card className="bg-card/70 backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  Portal performance
                  {p.bestPortal ? (
                    <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20">
                      <Trophy className="size-3" /> Best: {p.bestPortal.label} · {p.bestPortal.responseRate}%
                    </Badge>
                  ) : null}
                </CardTitle>
                <CardDescription>Response & interview rates per connected job portal</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto rounded-lg border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead>Portal</TableHead>
                        <TableHead className="text-right">Applications</TableHead>
                        <TableHead className="text-right">Interviews</TableHead>
                        <TableHead className="text-right">Offers</TableHead>
                        <TableHead className="text-right">Response rate</TableHead>
                        <TableHead className="text-right">Interview rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {p.portals.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                            No applications in this window yet — run the engine or apply manually.
                          </TableCell>
                        </TableRow>
                      ) : (
                        p.portals.map((row) => {
                          const best = p.bestPortal?.portal === row.portal
                          return (
                            <TableRow key={row.portal} className={best ? 'bg-emerald-500/5' : undefined}>
                              <TableCell className="font-medium">
                                <span className="inline-flex items-center gap-1.5">
                                  {row.label}
                                  {best ? <Trophy className="size-3.5 text-emerald-500" aria-label="Best performing portal" /> : null}
                                </span>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{row.applications}</TableCell>
                              <TableCell className="text-right tabular-nums">{row.interviews}</TableCell>
                              <TableCell className="text-right tabular-nums">{row.offers}</TableCell>
                              <TableCell className="text-right tabular-nums">{row.responseRate}%</TableCell>
                              <TableCell className="text-right tabular-nums">{row.interviewRate}%</TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </TooltipProvider>
  )
}
