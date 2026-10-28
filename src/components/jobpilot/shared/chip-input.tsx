'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { X } from 'lucide-react'

export function ChipInput({
  values, onChange, placeholder, accent = false,
}: {
  values: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  accent?: boolean
}) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const v = draft.trim()
    if (v && !values.includes(v)) onChange([...values, v])
    setDraft('')
  }

  return (
    <div className="rounded-lg border border-input bg-transparent p-2 focus-within:ring-2 focus-within:ring-ring/50">
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <Badge
            key={v}
            variant="secondary"
            className={accent ? 'bg-primary/10 text-primary hover:bg-primary/15' : ''}
          >
            {v}
            <button
              type="button"
              aria-label={`Remove ${v}`}
              className="ml-1 rounded-full hover:bg-foreground/10 p-0.5"
              onClick={() => onChange(values.filter((x) => x !== v))}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          onBlur={add}
          placeholder={placeholder}
          className="h-7 flex-1 min-w-28 border-0 bg-transparent p-1 text-sm shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  )
}
