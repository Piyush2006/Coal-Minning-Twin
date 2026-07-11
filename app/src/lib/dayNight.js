// Day/night state. `nightMix.v` is the LIVE blend (0 = day … 1 = night),
// eased toward the toggle over ~5 s by DayNightDriver — sky, fog, lights,
// IBL intensity and exposure all read it per frame, so the transition is one
// smooth cross-fade with no pops and no React re-renders on the hot path.
import { create } from 'zustand'

export const nightMix = { v: 0 }

export const useDayNight = create((set) => ({
  night: false,
  setNight: (night) => set({ night: !!night }),
  toggle: () => set(s => ({ night: !s.night })),
}))

export const NIGHT_DEFAULTS = {
  zenith: '#0d1524', horizon: '#25303f', ground: '#0b0d10', fog: '#222c39',
  dim: 0.24,             // IBL / environmentIntensity factor at full night
  exposure: 0.9,         // exposure factor at full night
  emissiveBoost: 2.4,    // lamp emissiveIntensity multiplier at night
}
