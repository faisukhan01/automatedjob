import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get('type') ?? 'all'
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 100), 200)
    const logs = await db.activityLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
    const filtered = logs.filter((l) => type === 'all' || l.type === type)
    return NextResponse.json({
      logs: filtered.slice(0, limit).map((l) => ({
        id: l.id, type: l.type, title: l.title, detail: l.detail,
        portalSlug: l.portalSlug, createdAt: l.createdAt.toISOString(),
      })),
      counts: logs.reduce<Record<string, number>>((acc, l) => ({ ...acc, [l.type]: (acc[l.type] ?? 0) + 1 }), {}),
    })
  } catch (e) {
    console.error('[activity GET]', e)
    return NextResponse.json({ error: 'Failed to load activity' }, { status: 500 })
  }
}
