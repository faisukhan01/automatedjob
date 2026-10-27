import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const data: { saved?: boolean; status?: string } = {}
    if (typeof body.saved === 'boolean') data.saved = body.saved
    if (typeof body.status === 'string') data.status = body.status
    if (!Object.keys(data).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    const job = await db.job.update({ where: { id }, data })
    return NextResponse.json({ ok: true, id: job.id, saved: job.saved, status: job.status })
  } catch (e) {
    console.error('[jobs PATCH]', e)
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 })
  }
}
