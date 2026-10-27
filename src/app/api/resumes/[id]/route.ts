import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    if (body.isPrimary === true) {
      await db.$transaction([
        db.resume.updateMany({ data: { isPrimary: false } }),
        db.resume.update({ where: { id }, data: { isPrimary: true } }),
      ])
    }
    return NextResponse.json({ ok: true, message: 'Primary resume updated' })
  } catch (e) {
    console.error('[resumes PATCH]', e)
    return NextResponse.json({ error: 'Failed to update resume' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const resume = await db.resume.findUnique({ where: { id } })
    if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
    await db.resume.delete({ where: { id } })
    const remaining = await db.resume.count()
    if (resume.isPrimary && remaining > 0) {
      const next = await db.resume.findFirst()
      if (next) await db.resume.update({ where: { id: next.id }, data: { isPrimary: true } })
    }
    return NextResponse.json({ ok: true, message: 'Resume deleted' })
  } catch (e) {
    console.error('[resumes DELETE]', e)
    return NextResponse.json({ error: 'Failed to delete resume' }, { status: 500 })
  }
}
