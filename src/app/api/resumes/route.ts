import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const resumes = await db.resume.findMany({ orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }] })
    return NextResponse.json(
      resumes.map((r) => ({
        id: r.id, name: r.name, fileName: r.fileName, targetRole: r.targetRole,
        isPrimary: r.isPrimary, atsScore: r.atsScore, skillsCovered: JSON.parse(r.skillsCovered),
        createdAt: r.createdAt.toISOString(),
      }))
    )
  } catch (e) {
    console.error('[resumes GET]', e)
    return NextResponse.json({ error: 'Failed to load resumes' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const name = String(body.name ?? '').trim()
    if (!name) return NextResponse.json({ error: 'Resume name is required' }, { status: 400 })
    const targetRole = typeof body.targetRole === 'string' && body.targetRole.trim() ? body.targetRole.trim() : null

    const count = await db.resume.count()
    const atsScore = 72 + ((name.length * 7 + count * 3) % 23)
    const skillsPool = ['Next.js', 'TypeScript', 'React', 'Node.js', 'Python', 'FastAPI', 'Laravel', 'PostgreSQL', 'Docker', 'AWS']
    const skillsCovered = skillsPool.slice(0, 5 + (count % 4))

    const resume = await db.resume.create({
      data: {
        name,
        fileName: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.pdf`,
        targetRole,
        isPrimary: count === 0,
        atsScore,
        skillsCovered: JSON.stringify(skillsCovered),
      },
    })
    await db.activityLog.create({
      data: { type: 'resume_added', title: 'Resume uploaded', detail: `${name} · ATS score ${atsScore}`, meta: JSON.stringify({ atsScore }) },
    })
    return NextResponse.json({
      ok: true,
      resume: { id: resume.id, name: resume.name, fileName: resume.fileName, targetRole: resume.targetRole, isPrimary: resume.isPrimary, atsScore: resume.atsScore, skillsCovered, createdAt: resume.createdAt.toISOString() },
      message: `Resume uploaded — ATS score ${atsScore}/100`,
    })
  } catch (e) {
    console.error('[resumes POST]', e)
    return NextResponse.json({ error: 'Failed to upload resume' }, { status: 500 })
  }
}
