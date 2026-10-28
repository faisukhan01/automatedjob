'use client'

import type { ReactNode } from 'react'

export function SectionHeader({
  title, description, children,
}: {
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{description}</p> : null}
      </div>
      {children ? <div className="flex items-center gap-2 flex-wrap">{children}</div> : null}
    </div>
  )
}
