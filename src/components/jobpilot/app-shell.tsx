'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useUI } from '@/lib/store'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { Footer } from './footer'
import { DashboardView } from './views/dashboard-view'
import { DiscoverView } from './views/discover-view'
import { ApplicationsView } from './views/applications-view'
import { PortalsView } from './views/portals-view'
import { AutomationView } from './views/automation-view'
import { InsightsView } from './views/insights-view'
import { ResumeView } from './views/resume-view'
import { ActivityView } from './views/activity-view'
import { useEffect } from 'react'

const VIEWS: Record<string, React.ComponentType> = {
  dashboard: DashboardView,
  discover: DiscoverView,
  applications: ApplicationsView,
  portals: PortalsView,
  automation: AutomationView,
  insights: InsightsView,
  resume: ResumeView,
  activity: ActivityView,
}

export function AppShell() {
  const view = useUI((s) => s.view)
  const View = VIEWS[view] ?? DashboardView

  // react to browser back/forward is not needed; keep view state simple
  useEffect(() => {
    document.title = `JobPilot AI — ${view.charAt(0).toUpperCase() + view.slice(1)}`
  }, [view])

  return (
    <div className="min-h-screen flex flex-col bg-background bg-glow">
      <div className="flex w-full flex-1">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-6xl">
              <AnimatePresence mode="wait">
                <motion.div
                  key={view}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  <View />
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
          <Footer />
        </div>
      </div>
    </div>
  )
}
