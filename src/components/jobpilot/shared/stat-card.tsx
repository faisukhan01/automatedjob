'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import type { LucideIcon } from 'lucide-react'

const ACCENTS = {
  emerald: 'bg-emerald-500/12 text-emerald-500',
  amber: 'bg-amber-500/12 text-amber-500',
  violet: 'bg-violet-500/12 text-violet-500',
  rose: 'bg-rose-500/12 text-rose-500',
} as const

function useCountUp(target: number, duration = 650) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      setV(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return v
}

export function StatCard({
  title, value, suffix = '', sub, icon: Icon, accent = 'emerald',
}: {
  title: string
  value: number
  suffix?: string
  sub?: string
  icon: LucideIcon
  accent?: keyof typeof ACCENTS
}) {
  const animated = useCountUp(value)
  const display = Number.isInteger(value) ? Math.round(animated) : Math.round(animated * 10) / 10
  return (
    <Card className="p-4 md:p-5 bg-card/70 backdrop-blur transition-shadow hover:shadow-lg hover:shadow-primary/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-1.5 text-2xl md:text-3xl font-bold tracking-tight tabular-nums">
            {display}
            <span className="text-base font-semibold text-muted-foreground">{suffix}</span>
          </p>
          {sub ? <p className="mt-1 text-xs text-muted-foreground truncate">{sub}</p> : null}
        </div>
        <div className={`rounded-xl p-2.5 ${ACCENTS[accent]}`}>
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  )
}
