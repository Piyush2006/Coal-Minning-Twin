// Dashboard state — global filters (ephemeral) + user Settings (persisted).
// Only `settings` is written to localStorage; the range/filter selection resets
// to a sensible default each session (Date objects don't round-trip cleanly).
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SETTINGS } from './data/settingsDefaults'
import { presetRange } from './data/time'

export const useDash = create(persist((set, get) => ({
  range: presetRange('Last 7 Days', DEFAULT_SETTINGS),
  mineId: 'all',
  areaId: 'all',
  equipTypeId: 'all',
  shiftMode: false,
  lastUpdated: new Date(),
  settings: DEFAULT_SETTINGS,
  tab: 'production',
  // The active operational plan (null until uploaded/entered). Shape:
  // { level, source:'upload'|'manual', createdAt, fileName?, rows:[{period,isMonth,shift?,plannedCoal,...}] }
  plan: null,
  planOpen: false,           // ephemeral: is the Plan Management drawer open

  setRange: (range) => set({ range }),
  setFilter: (key, value) => set({ [key]: value }),
  setShiftMode: (shiftMode) => set({ shiftMode }),
  setTab: (tab) => set({ tab }),
  refresh: () => set({ lastUpdated: new Date() }),
  setPlan: (plan) => set({ plan }),
  clearPlan: () => set({ plan: null }),
  setPlanOpen: (planOpen) => set({ planOpen }),
}), {
  name: 'blackridge-mgmt-dash',
  version: 2,
  partialize: (s) => ({ settings: s.settings, plan: s.plan }),
  // merge persisted state onto defaults so new fields always exist
  merge: (persisted, current) => ({
    ...current,
    ...(persisted || {}),
    settings: { ...DEFAULT_SETTINGS, ...((persisted && persisted.settings) || {}) },
    plan: (persisted && persisted.plan) || null,
  }),
}))
