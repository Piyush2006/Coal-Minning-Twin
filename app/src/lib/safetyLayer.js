// Safety overlay toggle — OFF by default so the base scene is unchanged.
// Turns on the PPE restricted-zone outlines, worker
// wearable tags and sensor pods. Mirrors the useDayNight store pattern (a tiny
// global boolean), independent of the fixed edit-mode `layers`.
import { create } from 'zustand'

export const useSafetyLayer = create((set) => ({
  on: false,
  setOn: (on) => set({ on }),
  toggle: () => set((s) => ({ on: !s.on })),
}))
