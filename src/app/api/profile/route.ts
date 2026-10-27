import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

function serialize(profile: Awaited<ReturnType<typeof db.profile.findFirst>>) {
  if (!profile) return null
  return {
    id: profile.id, fullName: profile.fullName, email: profile.email, phone: profile.phone,
    location: profile.location, headline: profile.headline, bio: profile.bio,
    yearsExperience: profile.yearsExperience, minSalary: profile.minSalary, remoteOnly: profile.remoteOnly,
    skills: JSON.parse(profile.skills), desiredRoles: JSON.parse(profile.desiredRoles),
    desiredLocations: JSON.parse(profile.desiredLocations), employmentTypes: JSON.parse(profile.employmentTypes),
  }
}

export async function GET() {
  try {
    const profile = await db.profile.findFirst()
    return NextResponse.json(serialize(profile) ?? { error: 'No profile' })
  } catch (e) {
    console.error('[profile GET]', e)
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const existing = await db.profile.findFirst()
    if (!existing) return NextResponse.json({ error: 'No profile found' }, { status: 404 })

    const asStringArray = (v: unknown, fallback: string[]) =>
      Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : fallback

    const profile = await db.profile.update({
      where: { id: existing.id },
      data: {
        fullName: typeof body.fullName === 'string' ? body.fullName : existing.fullName,
        email: typeof body.email === 'string' ? body.email : existing.email,
        phone: typeof body.phone === 'string' ? body.phone : existing.phone,
        location: typeof body.location === 'string' ? body.location : existing.location,
        headline: typeof body.headline === 'string' ? body.headline : existing.headline,
        bio: typeof body.bio === 'string' ? body.bio : existing.bio,
        yearsExperience: Number.isFinite(Number(body.yearsExperience)) ? Number(body.yearsExperience) : existing.yearsExperience,
        minSalary: Number.isFinite(Number(body.minSalary)) ? Number(body.minSalary) : existing.minSalary,
        remoteOnly: typeof body.remoteOnly === 'boolean' ? body.remoteOnly : existing.remoteOnly,
        skills: JSON.stringify(asStringArray(body.skills, JSON.parse(existing.skills))),
        desiredRoles: JSON.stringify(asStringArray(body.desiredRoles, JSON.parse(existing.desiredRoles))),
        desiredLocations: JSON.stringify(asStringArray(body.desiredLocations, JSON.parse(existing.desiredLocations))),
        employmentTypes: JSON.stringify(asStringArray(body.employmentTypes, JSON.parse(existing.employmentTypes))),
      },
    })

    await db.activityLog.create({
      data: { type: 'config_updated', title: 'Profile updated', detail: 'Career preferences saved — engine will use them on the next cycle', meta: '{}' },
    })
    return NextResponse.json({ ok: true, profile: serialize(profile) })
  } catch (e) {
    console.error('[profile PUT]', e)
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }
}
