'use client'

import { useOverview, useApplyJob, useProfile } from '@/lib/api'
import { useUI } from '@/lib/store'
import { StatCard } from '@/components/jobpilot/shared/stat-card'
import { MatchRing } from '@/components/jobpilot/shared/match-ring'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import {
  BriefcaseBusiness, Bot, Cable, TrendingUp, Sparkles, ArrowRight,
  Bot as EngineIcon, Send, RefreshCw, ArrowRightCircle, Plug, FileText, Settings2, PartyPopper, Loader2,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts'
import { STATUS_META, type ActivityLog } from '@/lib/types'

const STATUS_COLORS: Record<string, string> = {
  applied: '#8b8b93', screening: '#f59e0b', interview: '#8b5cf6',
  offer: '#10b981', rejected: '#f43f5e', withdrawn: '#6b7280',
}

const LOG_ICONS: Record<string, { icon: typeof Send; tint: string }> = {
  engine_run: { icon: EngineIcon, tint: 'bg-emerald-500/12 text-emerald-500' },
  application_sent: { icon: Send, tint: 'bg-violet-500/12 text-violet-500' },
  application_recorded: { icon: Send, tint: 'bg-violet-500/12 text-violet-500' },
  status_changed: { icon: ArrowRightCircle, tint: 'bg-amber-500/12 text-amber-500' },
  portal_connected: { icon: Plug, tint: 'bg-emerald-500/12 text-emerald-500' },
  portal_synced: { icon: RefreshCw, tint: 'bg-teal-500/12 text-teal-500' },
  resume_added: { icon: FileText, tint: 'bg-amber-500/12 text-amber-500' },
  config_updated: { icon: Settings2, tint: 'bg-zinc-500/12 text-zinc-400' },
  offer: { icon: PartyPopper, tint: 'bg-emerald-500/12 text-emerald-500' },
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function ActivityFeed({ logs }: { logs: ActivityLog[] }) {
  return (
    <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
      {logs.map((log) => {
        const meta = LOG_ICONS[log.type] ?? LOG_ICONS.config_updated
        return (
          <div key={log.id} className="flex gap-3">
            <div className={`grid size-8 shrink-0 place-items-center rounded-lg ${meta.tint}`}>
              <meta.icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{log.title}</p>
              {log.detail ? <p className="truncate text-xs text-muted-foreground">{log.detail}</p> : null}
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function DashboardView() {
  const { data, isLoading } = useOverview()
  const { data: profile } = useProfile()
  const setView = useUI((s) => s.setView)
  const applyJob = useApplyJob()

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          <Skeleton className="h-72 rounded-xl lg:col-span-3" />
          <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        </div>
      </div>
    )
  }

  const { totals } = data
  const donut = data.byStatus.filter((s) => s.count > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">
          {greeting()}, {(profile?.fullName ?? 'Faisal').split(' ')[0]} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.engineEnabled
            ? <>Auto-pilot is <span className="font-semibold text-emerald-500">live</span> — scanning {totals.jobs} jobs across {totals.connectedPortals} portals</>
            : 'Auto-pilot is paused — enable it from the Automation tab'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total applications" value={totals.applications} sub={`${totals.interviews} interviews · ${totals.offers} offers`} icon={BriefcaseBusiness} accent="violet" />
        <StatCard title="Auto-applied today" value={totals.autoToday} suffix={` / ${totals.dailyLimit}`} sub="Engine submissions" icon={Bot} accent="emerald" />
        <StatCard title="Connected portals" value={totals.connectedPortals} suffix=" / 6" sub={`${totals.newJobs} new jobs waiting`} icon={Cable} accent="amber" />
        <StatCard title="Response rate" value={data.responseRate} suffix="%" sub="Screening + interviews + offers" icon={TrendingUp} accent="rose" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Application velocity</CardTitle>
            <CardDescription>Submissions over the last 14 days</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.series} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="appGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.08} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid rgba(128,128,128,.25)', background: 'var(--popover)', color: 'var(--popover-foreground)', fontSize: 12 }}
                  labelStyle={{ color: 'var(--muted-foreground)' }}
                />
                <Area type="monotone" dataKey="count" name="Applications" stroke="#10b981" strokeWidth={2.5} fill="url(#appGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pipeline status</CardTitle>
            <CardDescription>Where your applications stand</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donut} dataKey="count" nameKey="status" innerRadius="58%" outerRadius="82%" paddingAngle={3} strokeWidth={0}>
                  {donut.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#8b8b93'} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, name) => [v, STATUS_META[String(name)]?.label ?? String(name)]}
                  contentStyle={{ borderRadius: 12, border: '1px solid rgba(128,128,128,.25)', background: 'var(--popover)', color: 'var(--popover-foreground)', fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1.5">
              {donut.map((s) => (
                <span key={s.status} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ background: STATUS_COLORS[s.status] }} />
                  {STATUS_META[s.status]?.label ?? s.status} · {s.count}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Portals by applications</CardTitle>
            <CardDescription>Where most applications went</CardDescription>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byPortal} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={78} />
                <Tooltip
                  cursor={{ fill: 'rgba(128,128,128,.08)' }}
                  contentStyle={{ borderRadius: 12, border: '1px solid rgba(128,128,128,.25)', background: 'var(--popover)', color: 'var(--popover-foreground)', fontSize: 12 }}
                />
                <Bar dataKey="count" name="Applications" fill="#10b981" radius={[0, 6, 6, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Recent activity</CardTitle>
              <CardDescription>Everything your auto-pilot did</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setView('activity')}>
              View all <ArrowRight className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            <ActivityFeed logs={data.recent} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" /> Top matches waiting
            </CardTitle>
            <CardDescription>Highest-scoring roles you haven&apos;t applied to yet</CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setView('discover')}>
            Browse jobs <ArrowRight className="size-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {data.topMatches.map((job) => (
            <div key={job.id} className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-primary/40">
              <MatchRing score={job.matchScore} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{job.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {job.company} · {job.location}
                </p>
              </div>
              <Button
                size="sm"
                className="gap-1"
                disabled={applyJob.isPending}
                onClick={() =>
                  toast.promise(applyJob.mutateAsync(job.id), {
                    loading: 'Submitting application…',
                    success: (res) => res.message,
                    error: (err) => err.message,
                  })
                }
              >
                {applyJob.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Apply
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
