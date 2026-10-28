'use client'

export function MatchRing({ score, size = 46, label }: { score: number; size?: number; label?: string }) {
  const r = (size - 7) / 2
  const c = 2 * Math.PI * r
  const color = score >= 80 ? 'stroke-emerald-500' : score >= 65 ? 'stroke-amber-500' : 'stroke-zinc-400'
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={label ?? `${score}% match`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={4} className="stroke-border" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} strokeWidth={4}
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)}
          strokeLinecap="round" fill="none"
          className={`${color} transition-all duration-700`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums">
        {score}
      </span>
    </div>
  )
}
