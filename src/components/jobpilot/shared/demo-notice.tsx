'use client'

import { useSyncExternalStore } from 'react'
import { FlaskConical, X, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Transparent demo-mode notice.
 * Explains exactly what is real (engine, scoring, database) and what is
 * simulated (portal connections & actual submissions) — shown in views
 * where users perform actions that only record data locally.
 */

const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  window.addEventListener('storage', cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', cb)
  }
}

export function DemoNotice({ className, storageKey }: { className?: string; storageKey: string }) {
  // Server snapshot = dismissed (hidden) → hydration-safe without effects.
  const dismissed = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(storageKey) === '1',
    () => true,
  )

  const dismiss = () => {
    window.localStorage.setItem(storageKey, '1')
    listeners.forEach((l) => l())
  }

  if (dismissed) return null

  return (
    <div
      role="note"
      aria-label="Demo mode notice"
      className={cn(
        'relative flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 p-4 text-sm',
        className,
      )}
    >
      <FlaskConical className="mt-0.5 size-4.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      <div className="min-w-0 flex-1 text-amber-900 dark:text-amber-200">
        <p className="font-semibold">Demo mode — what&apos;s real and what isn&apos;t</p>
        <p className="mt-1 leading-relaxed text-amber-800/90 dark:text-amber-200/80">
          The engine, AI cover letters, matching scores and analytics are <strong>real</strong> and run live.
          Job listings are <strong>sample data</strong>, and applying only <strong>records the application in
          this platform&apos;s own database</strong> — no employer receives it and no email is sent. Real submissions
          require official portal APIs (Indeed/LinkedIn don&apos;t allow third-party auto-apply; see the
          README for the production path).
        </p>
        <a
          href="https://github.com/faisukhan01/automatedjob#-going-to-production"
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-amber-700 underline-offset-2 hover:underline dark:text-amber-300"
        >
          Read how production mode works <ExternalLink className="size-3" aria-hidden />
        </a>
      </div>
      <button
        type="button"
        aria-label="Dismiss demo notice"
        onClick={dismiss}
        className="rounded-md p-1 text-amber-700 transition-colors hover:bg-amber-500/15 dark:text-amber-300"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}
