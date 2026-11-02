'use client'

import { useUI, type ViewId } from '@/lib/store'
import { NAV } from './sidebar'
import { useTheme } from 'next-themes'
import { useEngineStatus } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Menu, Moon, Sun, Github, Zap, FlaskConical } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function Topbar() {
  const view = useUI((s) => s.view)
  const setMobileNavOpen = useUI((s) => s.setMobileNavOpen)
  const { resolvedTheme, setTheme } = useTheme()
  const engine = useEngineStatus()
  const nav = NAV.find((n) => n.id === view)

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="flex items-center gap-3 px-4 py-3 md:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation"
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu className="size-5" />
        </Button>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{nav?.label ?? 'Dashboard'}</h2>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">{nav?.hint}</p>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex cursor-default items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
              <FlaskConical className="size-3.5" aria-hidden />
              Demo mode
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-64 text-balance">
            Sample jobs &amp; simulated portal connections. Applying records data locally — nothing is sent to employers.
          </TooltipContent>
        </Tooltip>

        <div
          className={cn(
            'hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium sm:flex',
            engine.data?.ok
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'border-zinc-400/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400'
          )}
        >
          <Zap className="size-3.5" />
          {engine.data?.ok ? `FastAPI v${engine.data.version ?? '1.0.0'}` : 'Engine offline · fallback'}
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle theme"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            >
              <Sun className="size-4.5 dark:hidden" />
              <Moon className="hidden size-4.5 dark:block" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle theme</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="GitHub repository" asChild>
              <a href="https://github.com/faisukhan01/automatedjob" target="_blank" rel="noreferrer">
                <Github className="size-4.5" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>GitHub repository</TooltipContent>
        </Tooltip>

        <Avatar className="size-8 border">
          <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">FK</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
