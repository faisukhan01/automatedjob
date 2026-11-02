'use client'

import { useState } from 'react'
import { usePortalAction, usePortals } from '@/lib/api'
import { SectionHeader } from '@/components/jobpilot/shared/section-header'
import { EmptyState } from '@/components/jobpilot/shared/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { Cable, Plug, PlugZap, RefreshCw, Loader2, BriefcaseBusiness, Send, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

const PORTAL_TINTS: Record<string, string> = {
  indeed: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
  linkedin: 'bg-teal-500/12 text-teal-600 dark:text-teal-400',
  glassdoor: 'bg-lime-500/12 text-lime-600 dark:text-lime-400',
  ziprecruiter: 'bg-violet-500/12 text-violet-600 dark:text-violet-400',
  monster: 'bg-amber-500/12 text-amber-600 dark:text-amber-400',
  naukri: 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
}

export function PortalsView() {
  const { data, isLoading } = usePortals()
  const action = usePortalAction()
  const [connecting, setConnecting] = useState<string | null>(null)
  const [creds, setCreds] = useState({ email: '', password: '' })
  const [syncingSlug, setSyncingSlug] = useState<string | null>(null)

  const portals = data ?? []

  const run = (p: { slug: string; action: string }, opts?: { onDone?: (msg: string) => void }) => {
    toast.promise(action.mutateAsync(p), {
      loading: 'Working…',
      success: (res) => {
        opts?.onDone?.(res.message ?? '')
        return res.message
      },
      error: (err) => err.message,
    })
  }

  const sync = async (slug: string) => {
    setSyncingSlug(slug)
    try {
      const res = await action.mutateAsync({ slug, action: 'sync' })
      toast.success(res.message ?? 'Synced')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSyncingSlug(null)
    }
  }

  const confirmConnect = () => {
    if (!connecting) return
    if (!creds.email || !creds.password) {
      toast.error('Enter the account email and password (demo credentials are fine)')
      return
    }
    run({ slug: connecting, action: 'connect' }, { onDone: () => { setConnecting(null); setCreds({ email: '', password: '' }) } })
  }

  return (
    <div>
      <SectionHeader
        title="Portal Connections"
        description="Link your job portal accounts. Connected portals are scanned for fresh roles and can be included in auto-apply."
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      ) : portals.length === 0 ? (
        <EmptyState icon={Cable} title="No portals configured" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {portals.map((portal) => {
            const connected = portal.status === 'connected'
            return (
              <Card key={portal.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('grid size-11 place-items-center rounded-xl text-lg font-black uppercase', PORTAL_TINTS[portal.slug] ?? 'bg-muted text-foreground')}>
                      {portal.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold">{portal.name}</p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs">
                        <span className={cn('size-1.5 rounded-full', connected ? 'bg-emerald-500' : 'bg-zinc-400')} />
                        <span className={connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
                          {connected ? 'Connected' : 'Not connected'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={portal.autoApply}
                    disabled={!connected}
                    aria-label={`Auto-apply on ${portal.name}`}
                    onCheckedChange={() => run({ slug: portal.slug, action: 'toggle-auto' })}
                  />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border p-2">
                    <p className="text-base font-bold tabular-nums">{portal.jobsCount}</p>
                    <p className="text-[10px] text-muted-foreground">jobs</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <p className="text-base font-bold tabular-nums">{portal.applicationsCount}</p>
                    <p className="text-[10px] text-muted-foreground">applied</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <p className="truncate text-xs font-semibold pt-1.5">
                      {portal.lastSyncAt ? formatDistanceToNow(new Date(portal.lastSyncAt), { addSuffix: true }) : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">last sync</p>
                  </div>
                </div>

                <div className="mt-auto flex gap-2 pt-4">
                  {connected ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={() => sync(portal.slug)}
                        disabled={syncingSlug === portal.slug}
                      >
                        {syncingSlug === portal.slug ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                        Sync now
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-rose-500 hover:text-rose-500"
                        onClick={() => run({ slug: portal.slug, action: 'disconnect' })}
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" className="w-full gap-1.5" onClick={() => setConnecting(portal.slug)}>
                      <PlugZap className="size-3.5" /> Connect {portal.name}
                    </Button>
                  )}
                </div>

                {connected ? (
                  <Badge variant="secondary" className={cn('mt-3 w-fit gap-1', portal.autoApply ? 'bg-primary/10 text-primary' : '')}>
                    <BriefcaseBusiness className="size-3" />
                    {portal.autoApply ? 'Included in auto-apply' : 'Auto-apply off'}
                  </Badge>
                ) : null}
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={!!connecting} onOpenChange={(open) => !open && setConnecting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plug className="size-4 text-primary" /> Connect {portals.find((p) => p.slug === connecting)?.name ?? connecting}
            </DialogTitle>
            <DialogDescription>
              JobPilot stores a secure session token and uses it to search &amp; apply on your behalf. In this demo environment no real credentials are transmitted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="portal-email">Account email</Label>
              <Input id="portal-email" type="email" placeholder="you@example.com" value={creds.email} onChange={(e) => setCreds((c) => ({ ...c, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="portal-password">Password</Label>
              <Input id="portal-password" type="password" placeholder="••••••••" value={creds.password} onChange={(e) => setCreds((c) => ({ ...c, password: e.target.value }))} />
            </div>
            <p className="flex items-center gap-1.5 rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 shrink-0 text-emerald-500" />
              Encrypted at rest · 2FA-aware · revoke access anytime
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnecting(null)}>Cancel</Button>
            <Button onClick={confirmConnect} disabled={action.isPending}>
              {action.isPending ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
              Connect securely
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
