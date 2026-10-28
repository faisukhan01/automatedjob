'use client'

import { create } from 'zustand'

export type ViewId = 'dashboard' | 'discover' | 'applications' | 'portals' | 'automation' | 'resume' | 'activity'

interface UIState {
  view: ViewId
  setView: (v: ViewId) => void
  mobileNavOpen: boolean
  setMobileNavOpen: (b: boolean) => void
}

export const useUI = create<UIState>((set) => ({
  view: 'dashboard',
  setView: (view) => set({ view, mobileNavOpen: false }),
  mobileNavOpen: false,
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
}))
