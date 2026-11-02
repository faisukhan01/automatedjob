'use client'

import { useState } from 'react'
import { useAutomation, useEngineRun, useEngineStatus, useOverview, useSaveAutomation } from '@/lib/api'
import { SectionHeader } from '@/components/jobpilot/shared/section-header'
import { DemoNotice } from '@/components/jobpilot/shared/demo-notice'
import { ChipInput } from '@/components/jobpilot/shared/chip-input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  Bot, Play, Loader2, Zap, Mail, Save, FileText, BookmarkPlus, Clock, Gauge, Sparkles,
} from 'lucide-react'

export function AutomationView() {
  const { data: config, isLoading } = useAutomation()
  const overview = useOverview()
  const engineStatus = useEngineStatus()
  const save = useSaveAutomation()
  const runEngine = useEngineRun()

  // draft holds only edited fields; merged view always reflects latest server config
  const [draft, setDraft] = useState<Partial<AutomationConfig>>({})
  const form: AutomationConfig | null = config ? { ...config, ...draft } : null

  const set = <K extends keyof AutomationConfig>(key: K, value: AutomationConfig[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const persist = (extra?: Partial<AutomationConfig>) => {
    if (!form) return
    const payload = { ...form, ...extra }
    toast.promise(
      save.mutateAsync(payload).then((res) => {
        setDraft({})
        return res
      }),
      {
        loading: 'Saving…',
        success: (res) => res.message,
        error: (err) => err.message,
      }
    )
  }

  const run = () =>
    toast.promise(runEngine.mutateAsync(), {
      loading: 'Auto-pilot scanning jobs, scoring & applying…',
      success: (res) => res.message,
      error: (err) => err.message,
    })

  if (isLoading || !config) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-44 rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    )
  }

  const autoToday = overview.data?.totals.autoToday ?? 0
  const limit = form.dailyLimit

  return (
    <div>
      <SectionHeader
        title="Automation"
        description="Configure the auto-pilot engine — it scores every new job against your profile and applies for you within your rules."
      />

      <DemoNotice storageKey="jp-demo-notice-automation" className="mb-5" />

      {/* Master control */}
      <Card className="mb-5 overflow-hidden">
        <div className="flex flex-col gap-4 bg-gradient-to-r from-primary/10 via-transparent to-transparent p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              <Bot className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold">Auto-Pilot Engine</p>
                <Badge variant="secondary" className={form.enabled ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' : ''}>
                  {form.enabled ? 'LIVE' : 'PAUSED'}
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Zap className="size-3" />
                  {engineStatus.data?.ok ? 'FastAPI backend' : 'fallback mode'}
                </Badge>
              </div>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                {form.enabled
                  ? `Applying to up to ${limit} matched jobs per day (min ${form.minMatchScore}% score), ${form.scheduleWindow}, quiet hours ${form.quietHours}.`
                  : 'Enable auto-pilot and the engine will start submitting applications for you.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => { set('enabled', v); persist({ enabled: v }) }}
              aria-label="Toggle auto-pilot"
            />
            <Button onClick={run} disabled={runEngine.isPending} className="gap-1.5">
              {runEngine.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              Run engine now
            </Button>
          </div>
        </div>
        <CardContent className="border-t pt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Today&apos;s auto-applications</span>
            <span className="font-semibold tabular-nums">{autoToday} / {limit}</span>
          </div>
          <Progress value={Math.min(100, (autoToday / Math.max(1, limit)) * 100)} className="mt-2 h-2" />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Gauge className="size-4 text-primary" />Application rules</CardTitle>
            <CardDescription>The engine never exceeds these limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Daily application limit</Label>
                <Badge variant="secondary" className="tabular-nums">{form.dailyLimit} / day</Badge>
              </div>
              <Slider value={[form.dailyLimit]} onValueChange={([v]) => set('dailyLimit', v)} min={1} max={50} step={1} />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Minimum match score</Label>
                <Badge variant="secondary" className="tabular-nums">{form.minMatchScore}%</Badge>
              </div>
              <Slider value={[form.minMatchScore]} onValueChange={([v]) => set('minMatchScore', v)} min={40} max={95} step={5} />
              <p className="mt-1.5 text-xs text-muted-foreground">Jobs scoring below this are never applied to</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="schedule" className="flex items-center gap-1.5"><Clock className="size-3.5" />Active window</Label>
                <Input id="schedule" value={form.scheduleWindow} onChange={(e) => set('scheduleWindow', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quiet" className="flex items-center gap-1.5"><Clock className="size-3.5" />Quiet hours</Label>
                <Input id="quiet" value={form.quietHours} onChange={(e) => set('quietHours', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Behaviour */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="size-4 text-primary" />Engine behaviour</CardTitle>
            <CardDescription>What the engine does on your behalf</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-center justify-between gap-4 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><FileText className="size-4" /></div>
                <div>
                  <p className="text-sm font-medium">AI cover letters</p>
                  <p className="text-xs text-muted-foreground">Generate a tailored letter per application</p>
                </div>
              </div>
              <Switch checked={form.autoCoverLetter} onCheckedChange={(v) => set('autoCoverLetter', v)} aria-label="AI cover letters" />
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-4 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-lg bg-amber-500/10 text-amber-500"><BookmarkPlus className="size-4" /></div>
                <div>
                  <p className="text-sm font-medium">Auto-save overflow jobs</p>
                  <p className="text-xs text-muted-foreground">Save great matches that exceed the daily limit</p>
                </div>
              </div>
              <Switch checked={form.autoSaveJobs} onCheckedChange={(v) => set('autoSaveJobs', v)} aria-label="Auto-save jobs" />
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-4 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-lg bg-violet-500/10 text-violet-500"><Mail className="size-4" /></div>
                <div>
                  <p className="text-sm font-medium">Email notifications</p>
                  <p className="text-xs text-muted-foreground">Daily digest of engine activity</p>
                </div>
              </div>
              <Switch checked={form.notifyEmail} onCheckedChange={(v) => set('notifyEmail', v)} aria-label="Email notifications" />
            </div>
            <Separator />
            <div className="p-3">
              <Label className="mb-2 block">Target keywords</Label>
              <ChipInput values={form.keywords} onChange={(v) => set('keywords', v)} placeholder="Type a keyword and press Enter" accent />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 flex justify-end">
        <Button size="lg" onClick={() => persist()} disabled={save.isPending} className="gap-2">
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save automation settings
        </Button>
      </div>
    </div>
  )
}
