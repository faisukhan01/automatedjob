'use client'

import { useState } from 'react'
import { useActivity } from '@/lib/api'
import { SectionHeader } from '@/components/jobpilot/shared/section-header'
import { EmptyState } from '@/components/jobpilot/shared/empty-state'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDistanceToNow } from 'date-fns'
import {
  Bot, Send, ArrowRightCircle, Plug, RefreshCw, FileText, Settings2, PartyPopper, History,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const LOG_META: Record<string, { icon: typeof Send; tint: string; label: string }> = {
  engine_run: { icon: Bot, tint: 'bg-emerald-500/12 text-emerald-500', label: 'Engine runs' },
  application_sent: { icon: Send, tint: 'bg-violet-500/12 text-violet-500', label: 'Applications' },
  status_changed: { icon: ArrowRightCircle, tint: 'bg-amber-500/12 text-amber-500', label: 'Status changes' },
  portal_connected: { icon: Plug, tint: 'bg-teal-500/12 text-teal-500', label: 'Portals' },
  portal_synced: { icon: RefreshCw, tint: 'bg-teal-500/12 text-teal-500', label: 'Portals' },
  resume_added: { icon: FileText, tint: 'bg-amber-500/12 text-amber-500', label: 'Resumes' },
  config_updated: { icon: Settings2, tint: 'bg-zinc-500/12 text-zinc-400', label: 'Settings' },
  offer: { icon: PartyPopper, tint: 'bg-emerald-500/12 text-emerald-500', label: 'Offers' },
}

export function ActivityView() {
  const [tab, setTab] = useState('all')
  const { data, isLoading } = useActivity(tab)
  const logs = data?.logs ?? []

  return (
    <div>
      <SectionHeader
        title="Activity"
        description="A complete audit trail of everything JobPilot did on your behalf."
      />

      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="all">All</TabsTrigger>
          {Object.entries(LOG_META)
            .filter(([key]) => key !== 'offer' && key !== 'portal_synced')
            .map(([key, meta]) => (
              <TabsTrigger key={key} value={key}>{meta.label}</TabsTrigger>
            ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState icon={History} title="No activity in this filter" description="Run the engine or sync a portal to generate activity." />
      ) : (
        <Card className="divide-y p-0">
          {logs.map((log) => {
            const meta = LOG_META[log.type] ?? LOG_META.config_updated
            return (
              <div key={log.id} className="flex gap-3.5 p-4 transition-colors hover:bg-muted/40">
                <div className={cn('grid size-9 shrink-0 place-items-center rounded-lg', meta.tint)}>
                  <meta.icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-sm font-semibold">{log.title}</p>
                    <p className="shrink-0 text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  {log.detail ? <p className="mt-0.5 text-xs text-muted-foreground">{log.detail}</p> : null}
                  {log.portalSlug ? (
                    <span className="mt-1.5 inline-block rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {log.portalSlug}
                    </span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}
