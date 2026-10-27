// JobPilot AI — local matching fallback (mirrors the FastAPI engine algorithm)
import type { ProfileFields, JobFields } from './types'

const norm = (s: string) => (s ?? '').toLowerCase().trim()

export function scoreJob(
  profile: ProfileFields,
  job: JobFields
): { score: number; reasons: string[]; matchedSkills: string[]; missingSkills: string[] } {
  let score = 0
  const reasons: string[] = []
  const jobSkills = (job.skills ?? []).map(norm).filter(Boolean)
  const userSkills = new Set((profile.skills ?? []).map(norm).filter(Boolean))
  const matched = jobSkills.filter((s) => userSkills.has(s))
  const missing = jobSkills.filter((s) => !userSkills.has(s))

  const skillPts = Math.min(matched.length * 12, 48)
  score += skillPts
  reasons.push(`${matched.length}/${jobSkills.length} skills matched (+${skillPts})`)

  const title = norm(job.title)
  const roles = (profile.desiredRoles ?? []).map(norm).filter(Boolean)
  let rolePts = 0
  if (roles.some((r) => title.includes(r) || r.includes(title))) rolePts = 22
  else if (roles.some((r) => r.split(/[\s—-]+/).some((w) => w.length > 3 && title.includes(w)))) rolePts = 12
  score += rolePts
  reasons.push(rolePts ? `role match (+${rolePts})` : 'outside desired roles')

  const min = profile.minSalary ?? 0
  if (!min) {
    score += 10
    reasons.push('no salary preference (+10)')
  } else if ((job.salaryMin ?? 0) >= min) {
    score += 15
    reasons.push('salary above minimum (+15)')
  } else if ((job.salaryMax ?? 0) >= min) {
    score += 8
    reasons.push('salary range covers minimum (+8)')
  } else {
    reasons.push('salary below desired minimum')
  }

  if (job.remote) {
    score += 12
    reasons.push('remote friendly (+12)')
  } else if ((profile.desiredLocations ?? []).some((l) => {
    const nl = norm(l)
    return nl && (norm(job.location).includes(nl) || nl.includes(norm(job.location)))
  })) {
    score += 8
    reasons.push('preferred location (+8)')
  }

  return { score: Math.max(35, Math.min(98, Math.round(score))), reasons, matchedSkills: matched, missingSkills: missing }
}

export function generateCoverLetter(profile: ProfileFields, job: JobFields): string {
  const name = profile.fullName ?? 'Candidate'
  const years = profile.yearsExperience ?? 3
  const company = job.company ?? 'your company'
  const title = job.title
  const topSkills = (job.skills ?? []).slice(0, 4).join(', ')
  return `Dear Hiring Team at ${company},

I'm excited to apply for the ${title} role. With ${years}+ years of hands-on experience${topSkills ? ` across ${topSkills}` : ''}, I have consistently designed, built and shipped production systems that are fast, reliable and delightful to use. Your team's focus on quality and scale strongly aligns with how I like to work.

In my recent work I delivered a full-stack platform that automated a previously manual workflow end-to-end — cutting turnaround time by more than half while improving reliability. I'd love to bring the same ownership and pragmatism to the ${title} position at ${company}.

I would welcome the chance to discuss how my background can contribute to your roadmap. Thank you for your time and consideration.

Best regards,
${name}`
}
