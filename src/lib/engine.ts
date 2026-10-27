// JobPilot AI — server-side helper to talk to the Python FastAPI automation engine
export const ENGINE_URL = process.env.ENGINE_URL || 'http://localhost:8001'

export type EngineHealth = { status: string; service: string; version: string; uptime_seconds: number } | null

export async function engineHealth(timeoutMs = 2500): Promise<EngineHealth> {
  try {
    const res = await fetch(`${ENGINE_URL}/health`, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function engineGet<T>(path: string, timeoutMs = 6000): Promise<T | null> {
  try {
    const res = await fetch(`${ENGINE_URL}${path}`, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function enginePost<T>(path: string, body: unknown, timeoutMs = 10000): Promise<T | null> {
  try {
    const res = await fetch(`${ENGINE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
