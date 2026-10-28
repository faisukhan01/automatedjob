'use client'

// Tiny typed fetch wrapper + react-query hooks for the JobPilot API

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error((data as { error?: string } | null)?.error ?? `Request failed (${res.status})`)
  }
  return data as T
}

type Msg = { message?: string }

import {
  useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query'
import type {
  ActivityLog, Application, AutomationConfig, EngineRunResult, EngineStatus,
  Job, Overview, Portal, Profile, Resume,
} from './types'

export type JobFilters = {
  q: string
  portal: string
  location: string
  remote: boolean
  minMatch: number
  minSalary: number
  status: string
  sort: string
}

export const defaultFilters: JobFilters = {
  q: '', portal: 'all', location: 'all', remote: false,
  minMatch: 0, minSalary: 0, status: 'all', sort: 'match',
}

export const useOverview = () =>
  useQuery({ queryKey: ['overview'], queryFn: () => api<Overview>('/api/overview'), refetchInterval: 60_000 })

export const usePortals = () =>
  useQuery({ queryKey: ['portals'], queryFn: () => api<Portal[]>('/api/portals') })

export const useJobs = (filters: JobFilters) => {
  const sp = new URLSearchParams({
    q: filters.q, portal: filters.portal, location: filters.location,
    remote: String(filters.remote), minMatch: String(filters.minMatch),
    minSalary: String(filters.minSalary), status: filters.status, sort: filters.sort,
  })
  return useQuery({
    queryKey: ['jobs', filters],
    queryFn: () => api<{ jobs: Job[]; facets: { locations: string[]; portals: string[] }; total: number }>(`/api/jobs?${sp}`),
  })
}

export const useApplications = (status = 'all') =>
  useQuery({
    queryKey: ['applications', status],
    queryFn: () => api<{ applications: Application[] }>(`/api/applications?status=${status}`),
  })

export const useProfile = () =>
  useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/api/profile') })

export const useResumes = () =>
  useQuery({ queryKey: ['resumes'], queryFn: () => api<Resume[]>('/api/resumes') })

export const useAutomation = () =>
  useQuery({ queryKey: ['automation'], queryFn: () => api<AutomationConfig>('/api/automation') })

export const useActivity = (type = 'all') =>
  useQuery({
    queryKey: ['activity', type],
    queryFn: () => api<{ logs: ActivityLog[]; counts: Record<string, number> }>(`/api/activity?type=${type}`),
  })

export const useEngineStatus = () =>
  useQuery({ queryKey: ['engine'], queryFn: () => api<EngineStatus>('/api/engine'), refetchInterval: 30_000 })

function useInvalidate() {
  const qc = useQueryClient()
  return (...keys: string[]) => {
    for (const key of keys) qc.invalidateQueries({ queryKey: [key] })
  }
}

export const useEngineRun = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: () => api<EngineRunResult & Msg>('/api/engine', { method: 'POST' }),
    onSuccess: () => invalidate('overview', 'applications', 'jobs', 'portals', 'activity', 'automation'),
  })
}

export const usePortalAction = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (p: { slug: string; action: string }) =>
      api<Msg>('/api/portals', { method: 'POST', body: JSON.stringify(p) }),
    onSuccess: () => invalidate('portals', 'jobs', 'overview', 'activity'),
  })
}

export const useApplyJob = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (jobId: string) =>
      api<Msg & { engine: string }>('/api/applications', { method: 'POST', body: JSON.stringify({ jobId, method: 'manual' }) }),
    onSuccess: () => invalidate('jobs', 'applications', 'portals', 'overview', 'activity'),
  })
}

export const useSaveJob = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (p: { id: string; saved: boolean }) =>
      api<{ saved: boolean }>(`/api/jobs/${p.id}`, { method: 'PATCH', body: JSON.stringify({ saved: p.saved }) }),
    onSuccess: () => invalidate('jobs', 'overview'),
  })
}

export const useUpdateApplication = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (p: { id: string; status: string }) =>
      api<{ status: string }>(`/api/applications/${p.id}`, { method: 'PATCH', body: JSON.stringify({ status: p.status }) }),
    onSuccess: () => invalidate('applications', 'overview', 'activity'),
  })
}

export const useSaveProfile = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (body: Partial<Profile>) =>
      api<Msg>('/api/profile', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => invalidate('profile', 'activity'),
  })
}

export const useAddResume = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (p: { name: string; targetRole?: string }) =>
      api<Msg>('/api/resumes', { method: 'POST', body: JSON.stringify(p) }),
    onSuccess: () => invalidate('resumes', 'activity'),
  })
}

export const useSetPrimaryResume = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) =>
      api<Msg>(`/api/resumes/${id}`, { method: 'PATCH', body: JSON.stringify({ isPrimary: true }) }),
    onSuccess: () => invalidate('resumes'),
  })
}

export const useDeleteResume = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => api<Msg>(`/api/resumes/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate('resumes'),
  })
}

export const useSaveAutomation = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (body: Partial<AutomationConfig>) =>
      api<Msg & { config: AutomationConfig }>('/api/automation', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => invalidate('automation', 'activity', 'overview'),
  })
}
