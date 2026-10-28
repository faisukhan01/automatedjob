'use client'

import type { LucideIcon } from 'lucide-react'

export function EmptyState({
  icon: Icon, title, description, children,
}: {
  icon: LucideIcon
  title: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-14 px-6 text-center">
      <div className="rounded-2xl bg-muted p-3.5">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      {description ? <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  )
}
