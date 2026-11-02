import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'

// JobPilot AI — Resume Import
//
// POST /api/resumes/import  (multipart/form-data, field: "file")
//
// 1. Extracts raw text from an uploaded PDF (unpdf) or Word document (mammoth)
// 2. Asks the LLM to structure it into profile fields (name, contacts, skills…)
// 3. Falls back to regex heuristics for anything the model missed
// 4. Auto-fills the user's profile, registers the resume with an ATS score
//    and writes an activity-log entry.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_BYTES = 8 * 1024 * 1024 // 8 MB

type Parsed = {
  fullName?: string
  email?: string
  phone?: string
  location?: string
  headline?: string
  bio?: string
  yearsExperience?: number
  skills?: string[]
  desiredRoles?: string[]
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/

function cleanList(v: unknown, max = 24): string[] {
  if (!Array.isArray(v)) return []
  return [...new Set(v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((s) => s.trim()))].slice(0, max)
}

async function extractText(file: File): Promise<{ text: string; kind: 'pdf' | 'docx' }> {
  const name = file.name.toLowerCase()
  const buf = new Uint8Array(await file.arrayBuffer())

  if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(buf)
    const { text } = await extractText(pdf, { mergePages: true })
    return { text: String(text ?? ''), kind: 'pdf' }
  }

  if (
    name.endsWith('.docx') ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buf) })
    return { text: result.value, kind: 'docx' }
  }

  throw new Error('UNSUPPORTED_TYPE')
}

function heuristicParse(text: string, base: Parsed): Parsed {
  const out: Parsed = { ...base }

  if (!out.email) {
    const m = text.match(EMAIL_RE)
    if (m) out.email = m[0]
  }
  if (!out.phone) {
    const m = text.replace(/\s+/g, ' ').match(PHONE_RE)
    if (m) out.phone = m[1].trim()
  }
  if (!out.fullName) {
    // First non-empty line that looks like a person name (2-4 words, alphabetic)
    for (const line of text.split('\n').slice(0, 6)) {
      const t = line.trim()
      if (/^[A-Za-z][A-Za-z'.-]+(?:\s+[A-Za-z][A-Za-z'.-]+){1,3}$/.test(t) && t.length < 42 && !/resume|curriculum|cv/i.test(t)) {
        out.fullName = t
        break
      }
    }
  }
  if (!out.skills || out.skills.length === 0) {
    const known = [
      'JavaScript', 'TypeScript', 'React', 'Next.js', 'Vue', 'Angular', 'Node.js', 'Express', 'Python',
      'Django', 'FastAPI', 'Flask', 'PHP', 'Laravel', 'Symfony', 'Java', 'Spring', 'Kotlin', 'Swift',
      'Go', 'Rust', 'C++', 'C#', '.NET', 'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'GraphQL',
      'REST API', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'CI/CD', 'Git', 'Linux', 'Tailwind CSS',
      'HTML', 'CSS', 'Sass', 'Tailwind', 'Prisma', 'Firebase', 'Kafka', 'RabbitMQ', 'Terraform',
    ]
    const found = known.filter((k) => new RegExp(`(^|[^a-z])${k.replace(/[.+*]/g, (c) => `\\${c}`)}([^a-z]|$)`, 'i').test(text))
    if (found.length) out.skills = found
  }
  return out
}

async function llmParse(text: string): Promise<Parsed> {
  const clipped = text.slice(0, 9000) // keep prompt tight
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.create({
    messages: [
      {
        role: 'assistant',
        content:
          'You are an expert resume-parsing engine. Extract structured data from the resume text the user provides. ' +
          'Respond with VALID JSON ONLY (no markdown fences, no commentary) using exactly this shape:\n' +
          '{"fullName":string,"email":string,"phone":string,"location":string,"headline":string,"bio":string,"yearsExperience":number,"skills":string[],"desiredRoles":string[]}\n' +
          'Rules:\n' +
          '- headline: the person\'s professional title (e.g. "Senior Full-Stack Engineer")\n' +
          '- bio: a 1-2 sentence professional summary based on their experience — do NOT invent facts\n' +
          '- yearsExperience: best estimate as a number from work-history dates (0 if unclear)\n' +
          '- skills: concrete technical/professional skills found in the resume (max 24, no duplicates)\n' +
          '- desiredRoles: job titles the person has held or is targeting (max 6)\n' +
          '- Use "" / [] / 0 when a field is genuinely not present. Never fabricate.',
      },
      { role: 'user', content: clipped },
    ],
    thinking: { type: 'disabled' },
  })

  const raw = completion.choices[0]?.message?.content ?? ''
  const jsonText = raw.replace(/^```(?:json)?/m, '').replace(/```\s*$/m, '').trim()
  const start = jsonText.indexOf('{')
  const end = jsonText.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('LLM returned no JSON')
  const obj = JSON.parse(jsonText.slice(start, end + 1)) as Parsed

  return {
    fullName: typeof obj.fullName === 'string' ? obj.fullName.trim().slice(0, 80) : undefined,
    email: EMAIL_RE.test(obj.email ?? '') ? obj.email!.trim() : undefined,
    phone: typeof obj.phone === 'string' && obj.phone.trim().length >= 7 ? obj.phone.trim().slice(0, 32) : undefined,
    location: typeof obj.location === 'string' ? obj.location.trim().slice(0, 80) : undefined,
    headline: typeof obj.headline === 'string' ? obj.headline.trim().slice(0, 100) : undefined,
    bio: typeof obj.bio === 'string' ? obj.bio.trim().slice(0, 600) : undefined,
    yearsExperience: Number.isFinite(obj.yearsExperience) ? Math.max(0, Math.min(50, Math.round(Number(obj.yearsExperience)))) : undefined,
    skills: cleanList(obj.skills),
    desiredRoles: cleanList(obj.desiredRoles, 6),
  }
}

function atsScoreFor(p: Parsed): number {
  let score = 38
  score += Math.min(26, (p.skills?.length ?? 0) * 2)
  if (p.email) score += 6
  if (p.phone) score += 5
  if (p.location) score += 5
  if (p.headline) score += 8
  if (p.bio && p.bio.length > 40) score += 8
  if ((p.yearsExperience ?? 0) > 0) score += 6
  return Math.max(35, Math.min(98, score))
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Attach a resume file (field "file")' }, { status: 400 })
    }
    if (file.size === 0) return NextResponse.json({ error: 'The file is empty' }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File is larger than 8 MB' }, { status: 400 })

    // ---- 1. text extraction -------------------------------------------------
    let text: string
    let kind: 'pdf' | 'docx'
    try {
      const res = await extractText(file)
      text = res.text
      kind = res.kind
    } catch (err) {
      if (err instanceof Error && err.message === 'UNSUPPORTED_TYPE') {
        return NextResponse.json({ error: 'Unsupported format — upload a PDF or Word (.docx) file' }, { status: 415 })
      }
      return NextResponse.json({ error: 'Could not read this file — it may be corrupted or password-protected' }, { status: 422 })
    }

    text = text.replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').trim()
    if (text.length < 60) {
      return NextResponse.json(
        { error: 'No readable text found — this looks like a scanned image. Upload a text-based PDF or Word file.' },
        { status: 422 },
      )
    }

    // ---- 2. AI parsing (with heuristic fallback) -----------------------------
    let parsed: Parsed
    let parser: 'ai' | 'heuristic' = 'ai'
    try {
      parsed = await llmParse(text)
      if (!parsed.fullName && !parsed.skills?.length && !parsed.email) throw new Error('empty AI result')
    } catch {
      parser = 'heuristic'
      parsed = heuristicParse(text, {})
    }
    parsed = heuristicParse(text, parsed) // fill gaps the AI missed (email/phone/name)

    const found =
      Object.entries({
        name: !!parsed.fullName, email: !!parsed.email, phone: !!parsed.phone,
        location: !!parsed.location, headline: !!parsed.headline,
        skills: parsed.skills?.length ?? 0, roles: parsed.desiredRoles?.length ?? 0,
      })

    // ---- 3. persist ----------------------------------------------------------
    const existing = await db.profile.findFirst()
    const profileData = {
      fullName: parsed.fullName ?? existing?.fullName ?? 'Your Name',
      email: parsed.email ?? existing?.email ?? 'you@example.com',
      phone: parsed.phone ?? existing?.phone ?? null,
      location: parsed.location ?? existing?.location ?? null,
      headline: parsed.headline ?? existing?.headline ?? null,
      bio: parsed.bio ?? existing?.bio ?? null,
      yearsExperience: parsed.yearsExperience ?? existing?.yearsExperience ?? 0,
      skills: JSON.stringify(parsed.skills?.length ? parsed.skills : safeArr(existing?.skills)),
      desiredRoles: JSON.stringify(parsed.desiredRoles?.length ? parsed.desiredRoles : safeArr(existing?.desiredRoles)),
      updatedAt: new Date(),
    }

    const profile = existing
      ? await db.profile.update({ where: { id: existing.id }, data: profileData })
      : await db.profile.create({ data: profileData })

    const atsScore = atsScoreFor(parsed)
    const resumeName = parsed.headline
      ? `${parsed.headline} — imported`
      : `${profileData.fullName} resume`
    const fileName = file.name

    const resume = await db.resume.create({
      data: {
        name: resumeName.slice(0, 90),
        fileName,
        targetRole: parsed.desiredRoles?.[0] ?? parsed.headline ?? null,
        isPrimary: (await db.resume.count()) === 0,
        atsScore,
        skillsCovered: JSON.stringify(parsed.skills ?? []),
      },
    })

    await db.activityLog.create({
      data: {
        type: 'resume_added',
        title: 'Resume imported — profile auto-filled',
        detail: `${file.name} (${kind.toUpperCase()}) · ${parsed.skills?.length ?? 0} skills · ATS ${atsScore}/100 · ${parser === 'ai' ? 'AI parse' : 'rule-based parse'}`,
        meta: JSON.stringify({ fileName, kind, atsScore, parser, skills: parsed.skills?.length ?? 0 }),
      },
    })

    return NextResponse.json({
      ok: true,
      parser,
      message: `Resume imported — ${parsed.skills?.length ?? 0} skills, ${parsed.yearsExperience ?? 0} yrs experience extracted`,
      extracted: found,
      atsScore,
      resume: {
        id: resume.id, name: resume.name, fileName: resume.fileName, targetRole: resume.targetRole,
        isPrimary: resume.isPrimary, atsScore: resume.atsScore,
        skillsCovered: parsed.skills ?? [], createdAt: resume.createdAt.toISOString(),
      },
      profile: {
        fullName: profile.fullName, email: profile.email, phone: profile.phone,
        location: profile.location, headline: profile.headline, bio: profile.bio,
        yearsExperience: profile.yearsExperience, skills: JSON.parse(profile.skills),
        desiredRoles: JSON.parse(profile.desiredRoles),
      },
    })
  } catch (e) {
    console.error('[resumes/import POST]', e)
    return NextResponse.json({ error: 'Import failed — try a different file' }, { status: 500 })
  }
}

function safeArr(json: string | undefined): string[] {
  try {
    const v = JSON.parse(json ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}
