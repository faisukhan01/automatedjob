import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { APPLICATION_STATUSES } from '@/lib/types'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  applied: 'Application submitted',
  screening: 'Moved to screening — recruiter reached out',
  interview: 'Technical interview scheduled',
  offer: '🎉 Offer received',
  rejected: 'Position closed — not selected',
  withdrawn: 'Application withdrawn',
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const status = String(body.status ?? '')
    if (!APPLICATION_STATUSES.includes(status as (typeof APPLICATION_STATUSES)[number])) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const existing = await db.application.findUnique({ where: { id }, include: { job: { include: { portal: true } } } })
    if (!existing) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

    const events = JSON.parse(existing.events)
    events.push({ at: new Date().toISOString(), label: STATUS_LABELS[status] ?? status })

    const updated = await db.application.update({ where: { id }, data: { status, events: JSON.stringify(events) } })
    await db.activityLog.create({
      data: {
        type: 'status_changed',
        title: `Application → ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        detail: `${existing.job.title} — ${existing.job.company}`,
        portalSlug: existing.job.portal?.slug ?? null,
        meta: JSON.stringify({ status }),
      },
    })
    return NextResponse.json({ ok: true, status: updated.status, events: JSON.parse(updated.events) })
  } catch (e) {
    console.error('[applications PATCH]', e)
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.application.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[applications DELETE]', e)
    return NextResponse.json({ error: 'Failed to delete application' }, { status: 500 })
  }
}
