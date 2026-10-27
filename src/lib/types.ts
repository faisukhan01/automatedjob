// JobPilot AI — shared types (client & server)

export type ProfileFields = {
  fullName?: string
  email?: string
  headline?: string
  yearsExperience?: number
  skills?: string[]
  desiredRoles?: string[]
  desiredLocations?: string[]
  minSalary?: number
  remoteOnly?: boolean
  [k: string]: unknown
}

export type JobFields = {
  id?: string
  title: string
  company?: string
  location?: string
  remote?: boolean
  salaryMin?: number | null
  salaryMax?: number | null
  skills?: string[]
  description?: string
}

export type Portal = {
  id: string
  name: string
  slug: string
  status: 'connected' | 'disconnected' | 'error'
  autoApply: boolean
  lastSyncAt: string | null
  applicationsCount: number
  jobsCount?: number
}

export type Job = {
  id: string
  portalId: string | null
  portalName: string
  portalSlug: string
  title: string
  company: string
  location: string
  remote: boolean
  employmentType: string
  salaryMin: number | null
  salaryMax: number | null
  description: string
  skills: string[]
  easyApply: boolean
  postedAt: string | null
  matchScore: number
  saved: boolean
  status: string
}

export type TimelineEvent = { at: string; label: string }

export type Application = {
  id: string
  jobId: string
  status: string
  method: string
  coverLetter: string | null
  matchScore: number
  events: TimelineEvent[]
  appliedAt: string
  job: Job
}

export type Profile = {
  id: string
  fullName: string
  email: string
  phone: string | null
  location: string | null
  headline: string | null
  bio: string | null
  yearsExperience: number
  skills: string[]
  desiredRoles: string[]
  desiredLocations: string[]
  employmentTypes: string[]
  minSalary: number
  remoteOnly: boolean
}

export type Resume = {
  id: string
  name: string
  fileName: string
  targetRole: string | null
  isPrimary: boolean
  atsScore: number
  skillsCovered: string[]
  createdAt: string
}

export type AutomationConfig = {
  id: string
  enabled: boolean
  dailyLimit: number
  minMatchScore: number
  autoCoverLetter: boolean
  autoSaveJobs: boolean
  notifyEmail: boolean
  scheduleWindow: string
  quietHours: string
  keywords: string[]
  updatedAt: string
}

export type ActivityLog = {
  id: string
  type: string
  title: string
  detail: string | null
  portalSlug: string | null
  createdAt: string
}

export type Overview = {
  totals: {
    jobs: number
    newJobs: number
    applications: number
    connectedPortals: number
    interviews: number
    offers: number
    autoToday: number
    dailyLimit: number
  }
  responseRate: number
  byStatus: { status: string; count: number }[]
  byPortal: { name: string; slug: string; count: number }[]
  series: { date: string; label: string; count: number }[]
  recent: ActivityLog[]
  topMatches: Job[]
}

export type EngineStatus = {
  ok: boolean
  service?: string
  version?: string
  uptimeSeconds?: number
}

export type EngineRunResult = {
  applied: { jobId: string; title: string; company: string; matchScore: number }[]
  saved: number
  skipped: number
  engine: 'fastapi' | 'fallback'
  message: string
}

export const APPLICATION_STATUSES = ['applied', 'screening', 'interview', 'offer', 'rejected', 'withdrawn'] as const

export const STATUS_META: Record<string, { label: string; color: string }> = {
  applied: { label: 'Applied', color: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300' },
  screening: { label: 'Screening', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  interview: { label: 'Interview', color: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
  offer: { label: 'Offer', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  rejected: { label: 'Rejected', color: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' },
  withdrawn: { label: 'Withdrawn', color: 'bg-zinc-500/15 text-zinc-500' },
}
