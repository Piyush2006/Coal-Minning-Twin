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

  setRange: (range) => set({ range }),
  setFilter: (key, value) => set({ [key]: value }),
  setShiftMode: (shiftMode) => set({ shiftMode }),
  refresh: () => set({ lastUpdated: new Date() }),
  updateSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
  resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
}), {
  name: 'blackridge-mgmt-dash',
  version: 1,
  partialize: (s) => ({ settings: s.settings }),
  // merge persisted settings onto defaults so new fields always exist
  merge: (persisted, current) => ({
    ...current,
    ...(persisted || {}),
    settings: { ...DEFAULT_SETTINGS, ...((persisted && persisted.settings) || {}) },
  }),
}))
