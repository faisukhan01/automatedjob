'use client'

import { useMemo, useState } from 'react'
import { useApplications, useUpdateApplication } from '@/lib/api'
import { SectionHeader } from '@/components/jobpilot/shared/section-header'
import { MatchRing } from '@/components/jobpilot/shared/match-ring'
import { EmptyState } from '@/components/jobpilot/shared/empty-state'
import { DemoNotice } from '@/components/jobpilot/shared/demo-notice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { Bot, Hand, History, BriefcaseBusiness, FileText } from 'lucide-react'
import { APPLICATION_STATUSES, STATUS_META, type Application } from '@/lib/types'
import { cn } from '@/lib/utils'

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.applied
  return <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', meta.color)}>{meta.label}</span>
}

export function ApplicationsView() {
  const [status, setStatus] = useState('all')
  const { data, isLoading } = useApplications(status)
  const update = useUpdateApplication()
  const [selected, setSelected] = useState<Application | null>(null)

  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const a of data?.applications ?? []) map[a.status] = (map[a.status] ?? 0) + 1
    return map
  }, [data])

  const apps = data?.applications ?? []

  const changeStatus = (app: Application, next: string) =>
    toast.promise(update.mutateAsync({ id: app.id, status: next }), {
      loading: 'Updating…',
      success: `Moved to ${STATUS_META[next]?.label}`,
      error: (err) => err.message,
    })

  return (
    <div>
      <SectionHeader
        title="Applications"
        description="Track every submission — auto-pilot and manual — across all connected portals."
      />

      <DemoNotice storageKey="jp-demo-notice-applications" className="mb-5" />

      <div className="mb-4 flex flex-wrap gap-2">
        {[{ key: 'all', label: 'All' }, ...APPLICATION_STATUSES.map((s) => ({ key: s, label: STATUS_META[s].label }))].map((chip) => (
          <button
            key={chip.key}
            onClick={() => setStatus(chip.key)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
              status === chip.key
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            {chip.label}
            {chip.key === 'all' ? ` · ${apps.length && status === 'all' ? apps.length : ''}` : counts[chip.key] ? ` · ${counts[chip.key]}` : ''}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : apps.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title="No applications here yet"
          description="Run the auto-pilot engine or apply manually from Job Discovery."
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Portal</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Timeline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((app) => (
                  <TableRow key={app.id} className="cursor-pointer" onClick={() => setSelected(app)}>
                    <TableCell>
                      <p className="max-w-56 truncate font-medium">{app.job.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{app.job.company} · {app.job.location}</p>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{app.job.portalName}</Badge></TableCell>
                    <TableCell><MatchRing score={app.matchScore} size={38} /></TableCell>
                    <TableCell>
                      {app.method === 'auto' ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><Bot className="size-3.5" />Auto</span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Hand className="size-3.5" />Manual</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(app.appliedAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select value={app.status} onValueChange={(v) => changeStatus(app, v)}>
                        <SelectTrigger className="h-8 w-36 border-0 bg-muted/60 text-xs font-semibold" aria-label="Change status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {APPLICATION_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={(e) => { e.stopPropagation(); setSelected(app) }}>
                        <History className="size-3.5" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {apps.map((app) => (
              <Card key={app.id} className="p-4" onClick={() => setSelected(app)}>
                <div className="flex items-start gap-3">
                  <MatchRing score={app.matchScore} size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{app.job.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{app.job.company} · via {app.job.portalName}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <StatusBadge status={app.status} />
                      <span className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(app.appliedAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent aria-describedby={undefined} className="w-full overflow-y-auto sm:max-w-md">
          {selected ? (
            <div>
              <SheetHeader className="p-0 text-left">
                <SheetTitle className="text-lg leading-snug">{selected.job.title}</SheetTitle>
                <SheetDescription>{selected.job.company} · via {selected.job.portalName}</SheetDescription>
              </SheetHeader>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <StatusBadge status={selected.status} />
                {selected.method === 'auto' ? (
                  <Badge variant="secondary" className="gap-1"><Bot className="size-3" />auto-pilot</Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1"><Hand className="size-3" />manual</Badge>
                )}
                <Badge variant="secondary">{selected.matchScore}% match</Badge>
              </div>

              <div className="mt-6">
                <p className="mb-3 text-sm font-semibold">Timeline</p>
                <ol className="relative space-y-4 border-l pl-5">
                  {selected.events.map((ev, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[27px] top-1 size-3 rounded-full border-2 border-background bg-primary" />
                      <p className="text-sm font-medium">{ev.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(ev.at), { addSuffix: true })}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>

              {selected.coverLetter ? (
                <div className="mt-6">
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                    <FileText className="size-4 text-primary" /> Cover letter used
                  </p>
                  <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                    {selected.coverLetter}
                  </pre>
                </div>
              ) : null}

              <div className="mt-6">
                <p className="mb-2 text-sm font-semibold">Change status</p>
                <div className="flex flex-wrap gap-2">
                  {APPLICATION_STATUSES.filter((s) => s !== selected.status).map((s) => (
                    <Button key={s} size="sm" variant="outline" onClick={() => changeStatus(selected, s)}>
                      {STATUS_META[s].label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
