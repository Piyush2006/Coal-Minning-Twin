import { create } from 'zustand'
import { useProjectStore } from './projectStore'

// Drives the full-screen Component Details view.
//   objId = asset being inspected.
//   sel   = null (root component) | { subId } (a sub-group) | { subId, index } (one instance).
// Not persisted.
export const useDetailsStore = create((set) => ({
  objId: null,
  sel: null,
  open: (objId) => { set({ objId, sel: null }); useProjectStore.setState({ view: 'details' }) },
  close: () => { set({ objId: null, sel: null }); useProjectStore.setState({ view: 'editor' }) },
  selectRoot: () => set({ sel: null }),
  selectGroup: (subId) => set({ sel: { subId } }),
  selectInstance: (subId, index) => set({ sel: { subId, index } }),
}))
