/**
 * JobPilot AI — Database seed
 * Rich, deterministic demo dataset across 6 job portals.
 * Run: bun prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// ---------- helpers ----------
const j = (v: unknown) => JSON.stringify(v)
const daysAgo = (d: number, hour = 10) => {
  const t = new Date()
  t.setDate(t.getDate() - d)
  if (d === 0) t.setHours(Math.max(0, t.getHours() - 2), (d * 13) % 60, 0, 0)
  else t.setHours(hour, (d * 13) % 60, 0, 0)
  return t
}

const PROFILE = {
  fullName: 'Faisal Khan',
  email: 'faisal.khan@example.com',
  phone: '+92 300 1234567',
  location: 'Karachi, Pakistan',
  headline: 'Senior Full-Stack Engineer · Next.js · Python · Laravel',
  bio: 'Full-stack engineer with 5+ years building SaaS platforms, automation systems and AI-powered products. Passionate about shipping fast without breaking things.',
  yearsExperience: 5,
  skills: ['React', 'Next.js', 'TypeScript', 'Node.js', 'Python', 'FastAPI', 'Laravel', 'PHP', 'PostgreSQL', 'MySQL', 'Docker', 'AWS', 'GraphQL', 'Tailwind CSS', 'Prisma', 'Redis'],
  desiredRoles: ['Full-Stack Engineer', 'Senior Frontend Engineer', 'Backend Engineer', 'Platform Engineer', 'Software Engineer'],
  desiredLocations: ['Remote', 'Karachi', 'Lahore', 'Dubai', 'Islamabad'],
  employmentTypes: ['full-time', 'contract'],
  minSalary: 55000,
  remoteOnly: false,
}

// ---------- deterministic pseudo random ----------
let seedState = 42
const rnd = () => {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296
  return seedState / 4294967296
}
const pick = <T,>(arr: T[], i: number) => arr[i % arr.length]

// ---------- job templates ----------
const COMPANIES = ['TechNova', 'CloudSprint', 'DataForge', 'PixelWorks', 'Quantum Labs', 'StreamLine', 'CoreStack', 'NexaSoft', 'OrbitPay', 'LumenHealth', 'FinEdge', 'AtlasLogistics', 'ZapCart', 'MediGrid', 'SolarisEnergy', 'BrightLearn']
const ROLES: { title: string; skills: string[] }[] = [
  { title: 'Senior Full-Stack Engineer', skills: ['React', 'Next.js', 'TypeScript', 'Node.js', 'PostgreSQL'] },
  { title: 'Frontend Engineer (React)', skills: ['React', 'TypeScript', 'Tailwind CSS', 'Next.js'] },
  { title: 'Backend Engineer — Python', skills: ['Python', 'FastAPI', 'PostgreSQL', 'Docker'] },
  { title: 'Full-Stack Developer (Laravel)', skills: ['PHP', 'Laravel', 'MySQL', 'Vue.js', 'Tailwind CSS'] },
  { title: 'Platform Engineer', skills: ['AWS', 'Docker', 'Kubernetes', 'Terraform', 'Node.js'] },
  { title: 'API Engineer (Node/GraphQL)', skills: ['Node.js', 'TypeScript', 'GraphQL', 'PostgreSQL'] },
  { title: 'DevOps Engineer', skills: ['Docker', 'AWS', 'Terraform', 'Python'] },
  { title: 'Data Engineer', skills: ['Python', 'SQL', 'Airflow', 'AWS'] },
  { title: 'React Native Engineer', skills: ['React Native', 'TypeScript', 'Node.js'] },
  { title: 'Product Engineer — AI SaaS', skills: ['Next.js', 'TypeScript', 'Prisma', 'PostgreSQL', 'Python'] },
  { title: 'Site Reliability Engineer', skills: ['Kubernetes', 'Python', 'AWS', 'Docker'] },
  { title: 'Software Engineer — Payments', skills: ['Node.js', 'TypeScript', 'Redis', 'PostgreSQL'] },
  { title: 'Web Engineer — E-commerce', skills: ['Next.js', 'PHP', 'Laravel', 'MySQL'] },
  { title: 'Machine Learning Engineer', skills: ['Python', 'PyTorch', 'Docker', 'AWS'] },
]
const LOCATIONS: { name: string; remote: boolean; min: number; max: number }[] = [
  { name: 'Remote — Global', remote: true, min: 70000, max: 140000 },
  { name: 'Remote — Pakistan', remote: true, min: 36000, max: 72000 },
  { name: 'Karachi, Pakistan', remote: false, min: 30000, max: 60000 },
  { name: 'Lahore, Pakistan', remote: false, min: 30000, max: 62000 },
  { name: 'Islamabad, Pakistan', remote: false, min: 32000, max: 64000 },
  { name: 'Dubai, UAE', remote: false, min: 66000, max: 125000 },
  { name: 'Riyadh, Saudi Arabia', remote: false, min: 62000, max: 118000 },
  { name: 'Singapore', remote: false, min: 84000, max: 150000 },
  { name: 'Berlin, Germany', remote: false, min: 78000, max: 132000 },
  { name: 'London, UK', remote: false, min: 82000, max: 145000 },
  { name: 'Austin, TX', remote: false, min: 90000, max: 155000 },
  { name: 'Toronto, Canada', remote: false, min: 84000, max: 140000 },
]
const EMPLOYMENT = ['full-time', 'full-time', 'full-time', 'contract']
const PORTALS = ['indeed', 'linkedin', 'glassdoor', 'ziprecruiter', 'monster', 'naukri']

function scoreJob(profile: typeof PROFILE, title: string, skills: string[], salaryMin: number, salaryMax: number, location: string, remote: boolean): number {
  let s = 0
  const ls = skills.map((x) => x.toLowerCase())
  const overlap = ls.filter((sk) => profile.skills.some((p) => p.toLowerCase() === sk)).length
  s += Math.min(overlap * 12, 48)
  const t = title.toLowerCase()
  if (profile.desiredRoles.some((r) => t.includes(r.split(' ')[0].toLowerCase()) || r.toLowerCase().includes(t.split(' ')[0].toLowerCase()))) s += 22
  if (salaryMin >= profile.minSalary) s += 15
  else if (salaryMax >= profile.minSalary) s += 8
  if (remote) s += 12
  else if (profile.desiredLocations.some((l) => location.includes(l))) s += 8
  return Math.max(35, Math.min(98, s))
}

function coverLetterFor(title: string, company: string): string {
  return `Dear Hiring Team at ${company},\n\nI'm excited to apply for the ${title} role. With 5+ years of experience across Next.js, TypeScript, Python/FastAPI and Laravel, I've shipped production SaaS platforms serving 100k+ users and cut deployment times by 60% through automation. Your product's focus on scale and developer experience aligns perfectly with what I do best.\n\nI'd love to walk you through how I built an automated CI/CD pipeline that reduced release cycles from days to hours.\n\nBest regards,\nFaisal Khan`
}

function buildEvents(status: string, appliedAt: Date): { at: string; label: string }[] {
  const at = (d: number) => new Date(appliedAt.getTime() + d * 86400000).toISOString()
  const base = [{ at: at(0), label: `Application submitted via ${status === 'x' ? '' : ''}auto-pilot` }]
  if (status === 'screening' || status === 'interview' || status === 'offer') base.push({ at: at(2), label: 'Recruiter viewed resume' })
  if (status === 'screening' || status === 'interview' || status === 'offer') base.push({ at: at(4), label: 'Moved to screening — recruiter reached out' })
  if (status === 'interview' || status === 'offer') base.push({ at: at(6), label: 'Technical interview scheduled' })
  if (status === 'offer') base.push({ at: at(9), label: '🎉 Offer received!' })
  if (status === 'rejected') base.push({ at: at(5), label: 'Position closed — not selected' })
  return base
}

async function main() {
  console.log('🌱 Seeding JobPilot AI database…')

  // wipe (order matters)
  await db.activityLog.deleteMany()
  await db.application.deleteMany()
  await db.job.deleteMany()
  await db.portal.deleteMany()
  await db.resume.deleteMany()
  await db.profile.deleteMany()
  await db.automationConfig.deleteMany()

  // profile
  await db.profile.create({ data: { ...PROFILE, skills: j(PROFILE.skills), desiredRoles: j(PROFILE.desiredRoles), desiredLocations: j(PROFILE.desiredLocations), employmentTypes: j(PROFILE.employmentTypes) } })

  // resumes
  await db.resume.createMany({
    data: [
      { name: 'Senior Full-Stack — ATS Optimized', fileName: 'faisal-khan-fullstack-v4.pdf', targetRole: 'Full-Stack Engineer', isPrimary: true, atsScore: 92, skillsCovered: j(['Next.js', 'TypeScript', 'Node.js', 'Python', 'FastAPI', 'Laravel', 'PostgreSQL', 'Docker']) },
      { name: 'Frontend Specialist', fileName: 'faisal-khan-frontend-v2.pdf', targetRole: 'Senior Frontend Engineer', atsScore: 84, skillsCovered: j(['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'GraphQL']) },
      { name: 'Backend / Platform', fileName: 'faisal-khan-backend-v3.pdf', targetRole: 'Backend Engineer', atsScore: 78, skillsCovered: j(['Python', 'FastAPI', 'Laravel', 'AWS', 'Redis', 'Docker']) },
    ],
  })

  // portals
  const portalDefs = [
    { name: 'Indeed', slug: 'indeed', status: 'connected' },
    { name: 'LinkedIn', slug: 'linkedin', status: 'connected' },
    { name: 'Glassdoor', slug: 'glassdoor', status: 'connected' },
    { name: 'ZipRecruiter', slug: 'ziprecruiter', status: 'disconnected' },
    { name: 'Monster', slug: 'monster', status: 'disconnected' },
    { name: 'Naukri', slug: 'naukri', status: 'disconnected' },
  ]
  const portals: Record<string, string> = {}
  for (const p of portalDefs) {
    const rec = await db.portal.create({
      data: { ...p, autoApply: p.status === 'connected', lastSyncAt: p.status === 'connected' ? daysAgo(0, 9) : null },
    })
    portals[p.slug] = rec.id
  }

  // jobs — 6 per role template = 84 jobs across portals
  const jobData: {
    portalId: string; title: string; company: string; location: string; remote: boolean; employmentType: string
    salaryMin: number; salaryMax: number; skills: string[]; description: string; postedAt: Date; matchScore: number; easyApply: boolean; externalId: string
  }[] = []
  ROLES.forEach((role, ri) => {
    for (let k = 0; k < 6; k++) {
      const loc = pick(LOCATIONS, ri * 3 + k * 2)
      const company = pick(COMPANIES, ri + k * 5)
      const portalSlug = pick(PORTALS, ri + k * 2)
      const salaryMin = Math.round((loc.min + rnd() * (loc.max - loc.min) * 0.4) / 1000) * 1000
      const salaryMax = Math.round((salaryMin + (loc.max - loc.min) * (0.35 + rnd() * 0.3)) / 1000) * 1000
      const postedAt = daysAgo(Math.floor(rnd() * 21))
      jobData.push({
        portalId: portals[portalSlug],
        title: role.title,
        company,
        location: loc.name,
        remote: loc.remote,
        employmentType: pick(EMPLOYMENT, ri + k),
        salaryMin,
        salaryMax,
        skills: role.skills,
        description: `${company} is hiring a ${role.title} to join their growing engineering team. You will design, build and ship features across the stack, collaborate with product & design, and help scale a platform serving thousands of daily users. Core stack: ${role.skills.join(', ')}. We value ownership, pragmatism and strong written communication. ${loc.remote ? 'Fully remote role with async-first culture.' : `Based in ${loc.name}, hybrid-friendly.`}`,
        postedAt,
        matchScore: scoreJob(PROFILE, role.title, role.skills, salaryMin, salaryMax, loc.name, loc.remote),
        easyApply: rnd() > 0.25,
        externalId: `${portalSlug}-${ri}-${k}`,
      })
    }
  })
  await db.job.createMany({ data: jobData.map((jd) => ({ ...jd, skills: j(jd.skills) })) })
  const allJobs = await db.job.findMany({ orderBy: { matchScore: 'desc' } })

  // applications — spread over last 30 days
  const statusPlan: { status: string; method: string }[] = [
    { status: 'interview', method: 'auto' }, { status: 'interview', method: 'auto' },
    { status: 'interview', method: 'manual' }, { status: 'offer', method: 'auto' },
    { status: 'screening', method: 'auto' }, { status: 'screening', method: 'auto' },
    { status: 'screening', method: 'manual' }, { status: 'screening', method: 'auto' },
    { status: 'applied', method: 'auto' }, { status: 'applied', method: 'auto' },
    { status: 'applied', method: 'manual' }, { status: 'applied', method: 'auto' },
    { status: 'applied', method: 'auto' }, { status: 'rejected', method: 'auto' },
    { status: 'rejected', method: 'auto' }, { status: 'rejected', method: 'manual' },
    { status: 'interview', method: 'auto' }, { status: 'applied', method: 'auto' },
  ]
  const topJobs = allJobs.filter((x) => x.matchScore >= 70)
  const resumes = await db.resume.findMany()
  const portalCounts: Record<string, number> = {}
  let ai = 0
  for (const plan of statusPlan) {
    const job = topJobs[ai % Math.min(topJobs.length, 30)]
    if (!job) break
    // avoid duplicates
    if (await db.application.findFirst({ where: { jobId: job.id } })) { ai++; continue }
    const appliedAt = daysAgo(Math.floor(rnd() * 30) + 1, 9 + (ai % 8))
    await db.application.create({
      data: {
        jobId: job.id,
        resumeId: pick(resumes, ai).id,
        status: plan.status,
        method: plan.method,
        matchScore: job.matchScore,
        coverLetter: coverLetterFor(job.title, job.company),
        events: j(buildEvents(plan.status, appliedAt)),
        appliedAt,
      },
    })
    await db.job.update({ where: { id: job.id }, data: { status: 'applied' } })
    if (job.portalId) portalCounts[job.portalId] = (portalCounts[job.portalId] || 0) + 1
    ai++
  }
  for (const [portalId, count] of Object.entries(portalCounts)) {
    await db.portal.update({ where: { id: portalId }, data: { applicationsCount: { increment: count } } })
  }

  // automation config
  await db.automationConfig.create({
    data: {
      id: 'main',
      enabled: true,
      dailyLimit: 20,
      minMatchScore: 70,
      autoCoverLetter: true,
      autoSaveJobs: true,
      notifyEmail: true,
      scheduleWindow: '09:00 - 18:00',
      quietHours: '23:00 - 07:00',
      keywords: j(['react', 'next.js', 'full-stack', 'typescript', 'python', 'laravel']),
    },
  })

  // activity logs
  const logs = [
    { type: 'engine_run', title: 'Auto-pilot cycle completed', detail: 'Applied to 5 new jobs · 2 saved · 8 below match threshold', meta: j({ applied: 5, saved: 2, skipped: 8 }) },
    { type: 'status_changed', title: 'Application moved to Interview', detail: 'Quantum Labs — Senior Full-Stack Engineer', meta: j({ status: 'interview' }) },
    { type: 'application_sent', title: 'Application sent via auto-pilot', detail: 'OrbitPay — Product Engineer — AI SaaS · 91% match', meta: j({ matchScore: 91 }) },
    { type: 'portal_connected', title: 'LinkedIn connected', detail: 'Session verified · profile sync complete', portalSlug: 'linkedin', meta: j({}) },
    { type: 'status_changed', title: 'Application moved to Screening', detail: 'StreamLine — Backend Engineer — Python', meta: j({ status: 'screening' }) },
    { type: 'resume_added', title: 'Resume uploaded', detail: 'Senior Full-Stack — ATS Optimized · ATS score 92', meta: j({ atsScore: 92 }) },
    { type: 'engine_run', title: 'Auto-pilot cycle completed', detail: 'Applied to 4 new jobs · 1 saved · 6 below match threshold', meta: j({ applied: 4 }) },
    { type: 'portal_synced', title: 'Indeed synced', detail: '12 new jobs fetched · 7 above 70% match', portalSlug: 'indeed', meta: j({ fetched: 12 }) },
    { type: 'offer', title: '🎉 Offer received', detail: 'LumenHealth — Senior Full-Stack Engineer', meta: j({}) },
    { type: 'config_updated', title: 'Automation settings updated', detail: 'Daily limit 15 → 20 · min match 65% → 70%', meta: j({}) },
    { type: 'application_sent', title: 'Application sent via auto-pilot', detail: 'TechNova — Senior Full-Stack Engineer · 94% match', meta: j({ matchScore: 94 }) },
    { type: 'portal_connected', title: 'Glassdoor connected', detail: 'Session verified · profile sync complete', portalSlug: 'glassdoor', meta: j({}) },
  ]
  for (let i = 0; i < logs.length; i++) {
    await db.activityLog.create({ data: { ...logs[i], createdAt: daysAgo(Math.floor(i / 2), 8 + (i % 10)) } })
  }

  const counts = {
    jobs: await db.job.count(),
    applications: await db.application.count(),
    portals: await db.portal.count(),
    logs: await db.activityLog.count(),
  }
  console.log('✅ Seed complete:', counts)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
