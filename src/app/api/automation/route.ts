import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const config = await db.automationConfig.findUnique({ where: { id: 'main' } })
    if (!config) return NextResponse.json({ error: 'Config missing' }, { status: 404 })
    return NextResponse.json({
      id: config.id, enabled: config.enabled, dailyLimit: config.dailyLimit,
      minMatchScore: config.minMatchScore, autoCoverLetter: config.autoCoverLetter,
      autoSaveJobs: config.autoSaveJobs, notifyEmail: config.notifyEmail,
      scheduleWindow: config.scheduleWindow, quietHours: config.quietHours,
      keywords: JSON.parse(config.keywords), updatedAt: config.updatedAt.toISOString(),
    })
  } catch (e) {
    console.error('[automation GET]', e)
    return NextResponse.json({ error: 'Failed to load automation config' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const existing = await db.automationConfig.findUnique({ where: { id: 'main' } })
    if (!existing) return NextResponse.json({ error: 'Config missing' }, { status: 404 })

    const clamp = (v: unknown, min: number, max: number, fallback: number) => {
      const n = Number(v)
      return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback
    }

    const dailyLimit = clamp(body.dailyLimit, 1, 50, existing.dailyLimit)
    const minMatchScore = clamp(body.minMatchScore, 40, 95, existing.minMatchScore)
    const enabled = typeof body.enabled === 'boolean' ? body.enabled : existing.enabled
    const keywords = Array.isArray(body.keywords)
      ? body.keywords.map((x: unknown) => String(x).trim().toLowerCase()).filter(Boolean)
      : JSON.parse(existing.keywords)

    const config = await db.automationConfig.update({
      where: { id: 'main' },
      data: {
        enabled, dailyLimit, minMatchScore, keywords: JSON.stringify(keywords),
        autoCoverLetter: typeof body.autoCoverLetter === 'boolean' ? body.autoCoverLetter : existing.autoCoverLetter,
        autoSaveJobs: typeof body.autoSaveJobs === 'boolean' ? body.autoSaveJobs : existing.autoSaveJobs,
        notifyEmail: typeof body.notifyEmail === 'boolean' ? body.notifyEmail : existing.notifyEmail,
        scheduleWindow: typeof body.scheduleWindow === 'string' && body.scheduleWindow.trim() ? body.scheduleWindow.trim() : existing.scheduleWindow,
        quietHours: typeof body.quietHours === 'string' && body.quietHours.trim() ? body.quietHours.trim() : existing.quietHours,
      },
    })

    const changes: string[] = []
    if (enabled !== existing.enabled) changes.push(`engine ${enabled ? 'enabled' : 'paused'}`)
    if (dailyLimit !== existing.dailyLimit) changes.push(`daily limit ${existing.dailyLimit} → ${dailyLimit}`)
    if (minMatchScore !== existing.minMatchScore) changes.push(`min match ${existing.minMatchScore}% → ${minMatchScore}%`)

    await db.activityLog.create({
      data: {
        type: 'config_updated',
        title: changes.length ? 'Automation settings updated' : 'Automation settings saved',
        detail: changes.join(' · ') || 'No changes detected',
        meta: '{}',
      },
    })

    return NextResponse.json({
      ok: true,
      message: enabled ? 'Auto-pilot is live' : 'Auto-pilot paused',
      config: {
        id: config.id, enabled: config.enabled, dailyLimit: config.dailyLimit,
        minMatchScore: config.minMatchScore, autoCoverLetter: config.autoCoverLetter,
        autoSaveJobs: config.autoSaveJobs, notifyEmail: config.notifyEmail,
        scheduleWindow: config.scheduleWindow, quietHours: config.quietHours,
        keywords: JSON.parse(config.keywords), updatedAt: config.updatedAt.toISOString(),
      },
    })
  } catch (e) {
    console.error('[automation PUT]', e)
    return NextResponse.json({ error: 'Failed to save automation config' }, { status: 500 })
  }
}
