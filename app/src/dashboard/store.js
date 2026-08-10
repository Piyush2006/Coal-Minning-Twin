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
  planPanel: 'plan',         // ephemeral: which panel — 'plan' | 'strata'
  bruceSeed: null,           // ephemeral: {q,n} — a question routed to Bruce from anywhere (opens + sends)
  // raised safety actions, keyed by evidence id → { assignee, priority, note, at }
  safetyActions: {},
  // edited borehole strata (Depth Profile), keyed by borehole id → strata[]
  boreholeStrata: {},
  // equipment job assignments (Equipment & Resources), keyed by jobId → unitId ('' = unassigned)
  resourceAssignments: {},

  setRange: (range) => set({ range }),
  setFilter: (key, value) => set({ [key]: value }),
  setShiftMode: (shiftMode) => set({ shiftMode }),
  setTab: (tab) => set({ tab }),
  refresh: () => set({ lastUpdated: new Date() }),
  setPlan: (plan) => set({ plan }),
  clearPlan: () => set({ plan: null }),
  setPlanOpen: (planOpen) => set({ planOpen }),
  openPlan: (planPanel = 'plan') => set({ planOpen: true, planPanel }),
  askBruce: (q) => set(s => ({ bruceSeed: { q, n: (s.bruceSeed?.n || 0) + 1 } })),
  raiseSafetyAction: (id, action) => set({ safetyActions: { ...get().safetyActions, [id]: { ...action, at: new Date().toISOString() } } }),
  setBoreholeStrata: (id, strata) => set({ boreholeStrata: { ...get().boreholeStrata, [id]: strata } }),
  resetBoreholeStrata: (id) => set(s => { const n = { ...s.boreholeStrata }; delete n[id]; return { boreholeStrata: n } }),
  setResourceAssignment: (jobId, unitId) => set({ resourceAssignments: { ...get().resourceAssignments, [jobId]: unitId } }),
  clearResourceAssignment: (jobId) => set(s => { const n = { ...s.resourceAssignments }; delete n[jobId]; return { resourceAssignments: n } }),
}), {
  name: 'blackridge-mgmt-dash',
  version: 2,
  partialize: (s) => ({ settings: s.settings, plan: s.plan, safetyActions: s.safetyActions, boreholeStrata: s.boreholeStrata, resourceAssignments: s.resourceAssignments }),
  // merge persisted state onto defaults so new fields always exist
  merge: (persisted, current) => ({
    ...current,
    ...(persisted || {}),
    settings: { ...DEFAULT_SETTINGS, ...((persisted && persisted.settings) || {}) },
    plan: (persisted && persisted.plan) || null,
    safetyActions: (persisted && persisted.safetyActions) || {},
    boreholeStrata: (persisted && persisted.boreholeStrata) || {},
    resourceAssignments: (persisted && persisted.resourceAssignments) || {},
  }),
}))
