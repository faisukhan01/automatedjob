'use client'

import { useRef, useState } from 'react'
import { useAddResume, useDeleteResume, useImportResume, useProfile, useResumes, useSaveProfile, useSetPrimaryResume, type ResumeImportResult } from '@/lib/api'
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
import { BadgeCheck, CloudUpload, FileText, Loader2, Save, Sparkles, Star, Trash2, Upload, UserRound, FileUp } from 'lucide-react'
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

  // ---- resume import (PDF / Word → auto-fill profile) ----
  const importResume = useImportResume()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importResult, setImportResult] = useState<ResumeImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const pickFile = () => {
    setImportResult(null)
    setImportError(null)
    fileInputRef.current?.click()
  }

  const onFilePicked = (f: File | undefined) => {
    if (!f) return
    const ok = /\.(pdf|docx?)$/i.test(f.name) || f.type === 'application/pdf'
    if (!ok) {
      setImportError('Only PDF or Word (.docx / .doc) files are supported')
      return
    }
    setImportError(null)
    toast.promise(importResume.mutateAsync(f), {
      loading: `Reading ${f.name} — AI is extracting your data…`,
      success: (res) => {
        setImportResult(res)
        // auto-fill every form field from the parsed resume
        setDraft((d) => ({ ...d, ...res.profile }))
        return res.message
      },
      error: (err) => {
        setImportError(err.message)
        return err.message
      },
    })
  }

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
        <Button onClick={() => { setImportOpen(true); pickFile() }} className="gap-1.5">
          <Sparkles className="size-4" /> Import resume
        </Button>
        <Button onClick={() => setUploadOpen(true)} variant="outline" className="gap-1.5">
          <Upload className="size-4" /> Add manually
        </Button>
      </SectionHeader>

      {/* hidden file input driving the import dialog */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf"
        className="hidden"
        onChange={(e) => {
          onFilePicked(e.target.files?.[0])
          e.target.value = ''
        }}
        aria-hidden
        tabIndex={-1}
      />

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

      {/* Import dialog (PDF / Word → AI auto-fill) */}
      <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) { setImportResult(null); setImportError(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" /> Import resume
            </DialogTitle>
            <DialogDescription>
              Upload a PDF or Word file — JobPilot reads it with AI and fills your whole profile automatically: contacts, headline, skills, experience.
            </DialogDescription>
          </DialogHeader>

          {!importResult ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={pickFile}
                disabled={importResume.isPending}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-6 py-8 text-center transition-colors hover:border-primary/70 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                {importResume.isPending ? (
                  <Loader2 className="size-8 animate-spin text-primary" />
                ) : (
                  <CloudUpload className="size-8 text-primary" />
                )}
                <span className="text-sm font-semibold">
                  {importResume.isPending ? 'Parsing your resume…' : 'Click to choose a file'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {importResume.isPending ? 'Extracting contacts, skills & experience with AI' : 'PDF or Word · up to 8 MB · text-based (not scanned)'}
                </span>
              </button>
              {importError ? (
                <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-500">{importError}</p>
              ) : (
                <p className="text-center text-[11px] text-muted-foreground">
                  Your profile is overwritten with the resume data — you can review & edit everything before saving.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <BadgeCheck className="size-8 shrink-0 text-emerald-500" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Resume parsed successfully</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {importResult.resume.fileName} · ATS score {importResult.atsScore}/100 · {importResult.parser === 'ai' ? 'AI extraction' : 'smart extraction'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {importResult.extracted.map(([key, val]) => (
                  <Badge key={key} variant="secondary" className="gap-1 text-[11px]">
                    <FileText className="size-3" />
                    {typeof val === 'number' ? `${val} ${key}` : `${key} found`}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Every form field on the left has been filled from your resume — review it, tweak anything, then hit <span className="font-semibold">Save profile</span>.
              </p>
              <div className="flex justify-end">
                <Button onClick={() => { setImportOpen(false); setImportResult(null) }}>Review my profile</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload resume</DialogTitle>
            <DialogDescription>
              Register a resume by name (no file parsing) — an ATS score is estimated. Use “Import resume” to auto-fill your profile from a real PDF/Word file.
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
