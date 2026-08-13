// Predictive-Maintenance bridge — surfaces the MANAGEMENT DASHBOARD's PdM engine
// (dashboard/calc/pdm.js, the same data behind the Predictive tab) inside the 3D
// twin. Static plant only: each twin machine maps to its dashboard asset id; a
// machine whose PdM severity is Warning/Critical gets a floating badge, and
// clicking the badge opens the dashboard's AlertDrawer right over the twin.
import { create } from 'zustand'
import { useMemo } from 'react'
import { useDash } from '../dashboard/store'
import { buildPdm } from '../dashboard/calc/pdm'

// twin object id -> dashboard PdM asset id (static plant only — no moving fleet)
export const TWIN_PDM_MAP = {
  'bh-drill-1': 'BD-01',
  'bh-drill-2': 'BD-02',
  'bh-drill-3': 'BD-03',
  'exc-ob-1':   'EX-01',
  'exc-coal-1': 'EX-02',
  'crusher-1':  'CR-01',
  'screen-1':   'SC-01',
}

// badge float height above each machine's origin (m)
export const BADGE_Y = {
  'bh-drill-1': 7.5, 'bh-drill-2': 7.5, 'bh-drill-3': 7.5,
  'exc-ob-1': 7.0, 'exc-coal-1': 7.0,
  'crusher-1': 10.0, 'screen-1': 7.0,
}

// which PdM drawer is open (holds the full alert/asset object), shared twin-side UI state
export const usePdmUI = create((set) => ({
  openAlert: null,
  open: (alert) => set({ openAlert: alert }),
  close: () => set({ openAlert: null }),
}))

// Tour helpers — open the PdM drawer for a preferred dashboard asset id (falls
// back to that asset's full record even when currently Normal, so the tour beat
// always has a panel to show), and close it again.
export function openPdmForTour(preferredId = 'CR-01') {
  try {
    const s = useDash.getState()
    const pdm = buildPdm({ range: s.range, mineId: s.mineId, areaId: s.areaId, equipTypeId: s.equipTypeId, settings: s.settings })
    const a = pdm.alerts.find(x => x.id === preferredId)
      || pdm.assets.find(x => x.id === preferredId)
      || pdm.alerts.find(x => Object.values(TWIN_PDM_MAP).includes(x.id))
    if (!a) return false
    usePdmUI.getState().open(a)
    return true
  } catch { return false }
}
export function closePdm() { usePdmUI.getState().close() }

// dashboard-asset-id -> alert object (Warning/Critical only — pdm.alerts is
// already filtered + sorted). Deterministic per dashboard filter state, so a
// plain memo is enough; it re-derives if the persisted dashboard state changes.
export function usePdmAlerts() {
  const range = useDash(s => s.range)
  const mineId = useDash(s => s.mineId)
  const areaId = useDash(s => s.areaId)
  const equipTypeId = useDash(s => s.equipTypeId)
  const settings = useDash(s => s.settings)
  return useMemo(() => {
    try {
      const pdm = buildPdm({ range, mineId, areaId, equipTypeId, settings })
      return new Map(pdm.alerts.map(a => [a.id, a]))
    } catch { return new Map() }
  }, [range, mineId, areaId, equipTypeId, settings])
}
