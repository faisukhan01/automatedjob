'use client'

import { Github } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

export function Footer() {
  return (
    <footer className="mt-auto border-t bg-card/40">
      <div className="flex flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-muted-foreground sm:flex-row md:px-6"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <p>
          © {new Date().getFullYear()} <span className="font-semibold text-foreground">JobPilot AI</span> — autonomous job applications
        </p>
        <div className="flex items-center gap-2">
          <span className="rounded-md border bg-background px-2 py-0.5">Next.js 16</span>
          <span className="rounded-md border bg-background px-2 py-0.5">TypeScript</span>
          <span className="rounded-md border bg-background px-2 py-0.5">FastAPI</span>
          <span className="rounded-md border bg-background px-2 py-0.5">Laravel</span>
          <span className="rounded-md border bg-background px-2 py-0.5">Prisma</span>
          <Separator orientation="vertical" className="hidden h-4 sm:block" />
          <a
            href="https://github.com/faisukhan01/automatedjob"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-medium hover:text-foreground"
            aria-label="GitHub repository"
          >
            <Github className="size-3.5" /> faisukhan01/automatedjob
          </a>
        </div>
      </div>
    </footer>
  )
}
