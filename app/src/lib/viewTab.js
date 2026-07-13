// Right-panel tab (Overview | Asset) as a store, so the tour's timed actions
// can switch it programmatically; ViewRightPanel reads/writes the same state.
import { create } from 'zustand'
export const useViewTab = create((set) => ({
  tab: 'overview',
  setTab: (tab) => set({ tab: tab === 'asset' ? 'asset' : 'overview' }),
}))
