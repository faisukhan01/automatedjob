'use client'

import { useUI, type ViewId } from '@/lib/store'
import { useEngineStatus, useEngineRun, useOverview, useAutomation } from '@/lib/api'
import { toast } from 'sonner'
import {
  LayoutDashboard, Radar, BriefcaseBusiness, Cable, Bot, ChartSpline, FileUser, History,
  Rocket, Play, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'

export const NAV: { id: ViewId; label: string; icon: typeof Rocket; hint: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, hint: 'Mission control' },
  { id: 'discover', label: 'Job Discovery', icon: Radar, hint: 'Matched roles' },
  { id: 'applications', label: 'Applications', icon: BriefcaseBusiness, hint: 'Pipeline tracker' },
  { id: 'portals', label: 'Portals', icon: Cable, hint: 'Connected accounts' },
  { id: 'automation', label: 'Automation', icon: Bot, hint: 'Auto-pilot engine' },
  { id: 'insights', label: 'Insights', icon: ChartSpline, hint: 'Funnel analytics' },
  { id: 'resume', label: 'Resume & Profile', icon: FileUser, hint: 'Career assets' },
  { id: 'activity', label: 'Activity', icon: History, hint: 'Full audit log' },
]

export function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
        <Rocket className="size-4.5" />
      </div>
      <div className="leading-tight">
        <p className="font-bold tracking-tight">
          JobPilot <span className="text-primary">AI</span>
        </p>
        <p className="text-[10px] text-muted-foreground">Autonomous apply engine</p>
      </div>
    </div>
  )
}

export function SidebarBody() {
  const view = useUI((s) => s.view)
  const setView = useUI((s) => s.setView)
  const overview = useOverview()
  const automation = useAutomation()
  const engineStatus = useEngineStatus()
  const runEngine = useEngineRun()
  const enabled = automation.data?.enabled ?? false
  const autoToday = overview.data?.totals.autoToday ?? 0
  const dailyLimit = overview.data?.totals.dailyLimit ?? 20

  const run = () => {
    toast.promise(runEngine.mutateAsync(), {
      loading: 'Running automation cycle…',
      success: (res) => res.message,
      error: (err) => err.message,
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-5">
        <BrandMark />
      </div>

      <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV.map((item) => {
          const active = view === item.id
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                active
                  ? 'bg-primary/10 font-semibold text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className={cn('size-4.5 shrink-0', active && 'text-primary')} />
              <span className="flex-1">{item.label}</span>
              {item.id === 'discover' && (overview.data?.totals.newJobs ?? 0) > 0 ? (
                <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px] bg-primary/15 text-primary">
                  {overview.data?.totals.newJobs}
                </Badge>
              ) : null}
            </button>
          )
        })}
      </nav>

      <div className="p-3">
        <div className="rounded-xl border bg-card/60 p-3.5">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              {enabled ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              ) : null}
              <span className={cn('relative inline-flex size-2 rounded-full', enabled ? 'bg-emerald-500' : 'bg-zinc-500')} />
            </span>
            <p className="text-xs font-semibold">{enabled ? 'Auto-pilot live' : 'Auto-pilot paused'}</p>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {autoToday}/{dailyLimit} applications today
            {engineStatus.data?.ok ? ' · FastAPI engine online' : ' · engine offline (fallback)'}
          </p>
          <Button size="sm" className="mt-3 w-full gap-1.5" onClick={run} disabled={runEngine.isPending}>
            {runEngine.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            Run engine now
          </Button>
        </div>
        <p className="mt-3 px-1 text-center text-[10px] text-muted-foreground">
          v1.0 · Next.js 16 + FastAPI + Laravel
        </p>
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r bg-sidebar md:block">
        <SidebarBody />
      </aside>
      <Sheet open={useUI((s) => s.mobileNavOpen)} onOpenChange={(b) => useUI.getState().setMobileNavOpen(b)}>
        <SheetContent side="left" aria-describedby={undefined} className="w-72 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBody />
        </SheetContent>
      </Sheet>
    </>
  )
}
