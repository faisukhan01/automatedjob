'use client'

import { useState } from 'react'
import { defaultFilters, useApplyJob, useJobs, useSaveJob, type JobFilters } from '@/lib/api'
import { SectionHeader } from '@/components/jobpilot/shared/section-header'
import { MatchRing } from '@/components/jobpilot/shared/match-ring'
import { EmptyState } from '@/components/jobpilot/shared/empty-state'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import {
  Bookmark, BookmarkCheck, Search, Radar, Loader2, MapPin, Banknote,
  Globe, Zap, ExternalLink, SlidersHorizontal,
} from 'lucide-react'
import type { Job } from '@/lib/types'

function fmtSalary(min: number | null, max: number | null) {
  if (!min && !max) return 'Salary undisclosed'
  const f = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`)
  if (min && max) return `${f(min)} – ${f(max)}/yr`
  return `${f(min || max!)}/yr`
}

export function DiscoverView() {
  const [filters, setFilters] = useState<JobFilters>(defaultFilters)
  const [selected, setSelected] = useState<Job | null>(null)
  const { data, isLoading } = useJobs(filters)
  const applyJob = useApplyJob()
  const saveJob = useSaveJob()

  const set = <K extends keyof JobFilters>(key: K, value: JobFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }))

  const jobs = data?.jobs ?? []

  const apply = (job: Job) =>
    toast.promise(applyJob.mutateAsync(job.id), {
      loading: `Applying to ${job.title}…`,
      success: (res) => res.message,
      error: (err) => err.message,
    })

  const toggleSave = (job: Job) =>
    toast.promise(saveJob.mutateAsync({ id: job.id, saved: !job.saved }), {
      loading: job.saved ? 'Removing…' : 'Saving…',
      success: job.saved ? 'Removed from saved jobs' : 'Job saved for later',
      error: (err) => err.message,
    })

  return (
    <div>
      <SectionHeader
        title="Job Discovery"
        description="Every role from your connected portals, scored against your profile by the matching engine."
      />

      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.q}
              onChange={(e) => set('q', e.target.value)}
              placeholder="Search roles, companies, keywords…"
              className="pl-9"
              aria-label="Search jobs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Select value={filters.portal} onValueChange={(v) => set('portal', v)}>
              <SelectTrigger aria-label="Filter by portal"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All portals</SelectItem>
                {(data?.facets.portals ?? []).map((p) => <SelectItem key={p} value={p.toLowerCase()}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.location} onValueChange={(v) => set('location', v)}>
              <SelectTrigger aria-label="Filter by location"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {(data?.facets.locations ?? []).map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.sort} onValueChange={(v) => set('sort', v)}>
              <SelectTrigger aria-label="Sort jobs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="match">Best match</SelectItem>
                <SelectItem value="recent">Most recent</SelectItem>
                <SelectItem value="salary">Highest salary</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center justify-center gap-2 rounded-lg border px-3 text-sm">
              <Globe className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Remote only</span>
              <Switch checked={filters.remote} onCheckedChange={(v) => set('remote', v)} aria-label="Remote only" />
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 border-t pt-3">
          <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" />
          <span className="shrink-0 text-xs text-muted-foreground">Min match</span>
          <Slider
            value={[filters.minMatch]}
            onValueChange={([v]) => set('minMatch', v)}
            min={0} max={95} step={5}
            className="flex-1"
            aria-label="Minimum match score"
          />
          <Badge variant="secondary" className="w-12 justify-center tabular-nums">{filters.minMatch}%</Badge>
        </div>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Radar}
          title="No jobs match your filters"
          description="Try widening your filters, or sync a portal from the Portals tab to discover fresh roles."
        />
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">{data?.total} jobs found</p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {jobs.map((job) => (
              <Card key={job.id} className="group flex flex-col p-4 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
                <div className="flex items-start gap-3">
                  <MatchRing score={job.matchScore} size={48} />
                  <div className="min-w-0 flex-1">
                    <button className="text-left text-sm font-semibold leading-snug hover:text-primary" onClick={() => setSelected(job)}>
                      {job.title}
                    </button>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {job.company} · {job.portalName}
                    </p>
                  </div>
                  <button
                    aria-label={job.saved ? 'Unsave job' : 'Save job'}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => toggleSave(job)}
                  >
                    {job.saved ? <BookmarkCheck className="size-4.5 text-primary" /> : <Bookmark className="size-4.5" />}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="gap-1"><MapPin className="size-3" />{job.location}</Badge>
                  {job.remote ? <Badge variant="secondary" className="gap-1 bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"><Globe className="size-3" />Remote</Badge> : null}
                  <Badge variant="secondary" className="gap-1 capitalize"><Banknote className="size-3" />{fmtSalary(job.salaryMin, job.salaryMax)}</Badge>
                  {job.easyApply ? <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary"><Zap className="size-3" />Easy apply</Badge> : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {job.skills.slice(0, 4).map((s) => (
                    <span key={s} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{s}</span>
                  ))}
                  {job.skills.length > 4 ? <span className="text-[10px] text-muted-foreground">+{job.skills.length - 4}</span> : null}
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                  <span className="text-[11px] text-muted-foreground">
                    {job.postedAt ? formatDistanceToNow(new Date(job.postedAt), { addSuffix: true }) : 'recent'}
                  </span>
                  {job.status === 'applied' ? (
                    <Badge variant="secondary" className="bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">Applied ✓</Badge>
                  ) : (
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => setSelected(job)}>Details</Button>
                      <Button size="sm" onClick={() => apply(job)} disabled={applyJob.isPending}>
                        {applyJob.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        Apply now
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected ? (
            <div>
              <SheetHeader className="p-0 text-left">
                <div className="flex items-start gap-3">
                  <MatchRing score={selected.matchScore} size={56} />
                  <div>
                    <SheetTitle className="text-lg leading-snug">{selected.title}</SheetTitle>
                    <SheetDescription>
                      {selected.company} · via {selected.portalName}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Salary</p>
                    <p className="mt-0.5 font-semibold">{fmtSalary(selected.salaryMin, selected.salaryMax)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Type</p>
                    <p className="mt-0.5 font-semibold capitalize">{selected.employmentType}{selected.remote ? ' · Remote' : ''}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="mt-0.5 font-semibold">{selected.location}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Posted</p>
                    <p className="mt-0.5 font-semibold">
                      {selected.postedAt ? formatDistanceToNow(new Date(selected.postedAt), { addSuffix: true }) : 'recent'}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-sm font-semibold">Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.skills.map((s) => (
                      <Badge key={s} variant="secondary">{s}</Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-sm font-semibold">Job description</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{selected.description}</p>
                </div>

                <div className="flex gap-2 pt-2">
                  {selected.status === 'applied' ? (
                    <Button className="flex-1" disabled>Applied ✓</Button>
                  ) : (
                    <Button className="flex-1" onClick={() => { apply(selected); setSelected(null) }}>
                      <ExternalLink className="size-4" /> Apply on {selected.portalName}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
