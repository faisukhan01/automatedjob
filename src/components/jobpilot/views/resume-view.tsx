'use client'

import { useState } from 'react'
import { useAddResume, useDeleteResume, useProfile, useResumes, useSaveProfile, useSetPrimaryResume } from '@/lib/api'
import { SectionHeader } from '@/components/jobpilot/shared/section-header'
import { ChipInput } from '@/components/jobpilot/shared/chip-input'
import { MatchRing } from '@/components/jobpilot/shared/match-ring'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Loader2, Save, Star, Trash2, Upload, UserRound, FileUp } from 'lucide-react'
import type { Profile } from '@/lib/types'

const ALL_TYPES = ['full-time', 'contract', 'part-time', 'internship']

export function ResumeView() {
  const { data: profile, isLoading } = useProfile()
  const resumes = useResumes()
  const saveProfile = useSaveProfile()
  const addResume = useAddResume()
  const setPrimary = useSetPrimaryResume()
  const deleteResume = useDeleteResume()

  // draft holds only edited fields; merged view always reflects latest server profile
  const [draft, setDraft] = useState<Partial<Profile>>({})
  const form: Partial<Profile> = { ...profile, ...draft }
  const [uploadOpen, setUploadOpen] = useState(false)
  const [upload, setUpload] = useState({ name: '', targetRole: '' })
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const save = () =>
    toast.promise(
      saveProfile.mutateAsync(form).then((res) => {
        setDraft({})
        return res
      }),
      {
        loading: 'Saving profile…',
        success: 'Profile saved — the engine will use it on the next cycle',
        error: (err) => err.message,
      }
    )

  const submitUpload = () => {
    if (!upload.name.trim()) {
      toast.error('Give your resume a name')
      return
    }
    toast.promise(addResume.mutateAsync(upload), {
      loading: 'Uploading…',
      success: (res) => res.message,
      error: (err) => err.message,
    })
    setUploadOpen(false)
    setUpload({ name: '', targetRole: '' })
  }

  if (isLoading || !profile) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 lg:grid-cols-5">
          <Skeleton className="h-96 rounded-xl lg:col-span-3" />
          <Skeleton className="h-96 rounded-xl lg:col-span-2" />
        </div>
      </div>
    )
  }

  return (
    <div>
      <SectionHeader title="Resume & Profile" description="Your career profile powers job matching, cover letters and auto-apply rules.">
        <Button onClick={() => setUploadOpen(true)} variant="outline" className="gap-1.5">
          <Upload className="size-4" /> Upload resume
        </Button>
      </SectionHeader>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Profile form */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><UserRound className="size-4 text-primary" />Career profile</CardTitle>
            <CardDescription>Used by the matching engine to score every job</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" value={form.fullName ?? ''} onChange={(e) => set('fullName', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location">Location</Label>
                <Input id="location" value={form.location ?? ''} onChange={(e) => set('location', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="headline">Headline</Label>
              <Input id="headline" value={form.headline ?? ''} onChange={(e) => set('headline', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" rows={3} value={form.bio ?? ''} onChange={(e) => set('bio', e.target.value)} />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="years">Years of experience</Label>
                <Input id="years" type="number" min={0} value={form.yearsExperience ?? 0} onChange={(e) => set('yearsExperience', Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="minSalary">Min salary (USD/yr)</Label>
                <Input id="minSalary" type="number" min={0} step={1000} value={form.minSalary ?? 0} onChange={(e) => set('minSalary', Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Remote only</Label>
                <div className="flex h-9 items-center gap-2 rounded-lg border px-3">
                  <Switch checked={form.remoteOnly ?? false} onCheckedChange={(v) => set('remoteOnly', v)} aria-label="Remote only" />
                  <span className="text-sm text-muted-foreground">{form.remoteOnly ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Skills</Label>
              <ChipInput values={form.skills ?? []} onChange={(v) => set('skills', v)} placeholder="Add a skill and press Enter" accent />
            </div>
            <div className="space-y-1.5">
              <Label>Desired roles</Label>
              <ChipInput values={form.desiredRoles ?? []} onChange={(v) => set('desiredRoles', v)} placeholder="Add a role and press Enter" accent />
            </div>
            <div className="space-y-1.5">
              <Label>Desired locations</Label>
              <ChipInput values={form.desiredLocations ?? []} onChange={(v) => set('desiredLocations', v)} placeholder="Add a location and press Enter" accent />
            </div>
            <div className="space-y-1.5">
              <Label>Employment types</Label>
              <div className="flex flex-wrap gap-4 pt-1">
                {ALL_TYPES.map((t) => (
                  <label key={t} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={(form.employmentTypes ?? []).includes(t)}
                      onCheckedChange={(checked) => {
                        const cur = form.employmentTypes ?? []
                        set('employmentTypes', checked ? [...cur, t] : cur.filter((x) => x !== t))
                      }}
                    />
                    <span className="capitalize">{t}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={save} disabled={saveProfile.isPending} className="gap-2">
                {saveProfile.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save profile
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resumes */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><FileUp className="size-4 text-primary" />Resumes</CardTitle>
            <CardDescription>The primary resume is attached to applications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(resumes.data ?? []).map((r) => (
              <div key={r.id} className="rounded-xl border p-3.5">
                <div className="flex items-start gap-3">
                  <MatchRing score={r.atsScore} size={44} label={`ATS score ${r.atsScore}`} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                      {r.name}
                      {r.isPrimary ? <Star className="size-3.5 fill-amber-400 text-amber-400" /> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{r.fileName}{r.targetRole ? ` · ${r.targetRole}` : ''}</p>
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {r.skillsCovered.slice(0, 5).map((s) => (
                    <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                  ))}
                </div>
                <div className="mt-3 flex gap-1.5">
                  <Button
                    size="sm" variant="outline" className="h-7 flex-1 text-xs"
                    disabled={r.isPrimary}
                    onClick={() => toast.promise(setPrimary.mutateAsync(r.id), { loading: 'Setting…', success: 'Primary resume updated', error: (e) => e.message })}
                  >
                    {r.isPrimary ? 'Primary ✓' : 'Set primary'}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-rose-500 hover:text-rose-500" aria-label={`Delete ${r.name}`} onClick={() => setDeletingId(r.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {resumes.data?.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No resumes yet — upload one to get started</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload resume</DialogTitle>
            <DialogDescription>
              In this demo the resume is registered (name + target role) and an ATS score is estimated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="resume-name">Resume name</Label>
              <Input id="resume-name" placeholder="e.g. Backend Engineer — ATS v5" value={upload.name} onChange={(e) => setUpload((u) => ({ ...u, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="resume-role">Target role</Label>
              <Input id="resume-role" placeholder="e.g. Backend Engineer" value={upload.targetRole} onChange={(e) => setUpload((u) => ({ ...u, targetRole: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button onClick={submitUpload} disabled={addResume.isPending}>
              {addResume.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this resume?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. If it was the primary resume, another one becomes primary automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => {
                if (deletingId) toast.promise(deleteResume.mutateAsync(deletingId), { loading: 'Deleting…', success: 'Resume deleted', error: (e) => e.message })
                setDeletingId(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
