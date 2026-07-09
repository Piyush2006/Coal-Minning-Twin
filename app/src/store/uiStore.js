import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Persisted chrome layout — sidebar widths + collapsed state.
export const useUIStore = create(
  persist(
    (set) => ({
      leftW: 268,
      rightW: 300,
      leftCollapsed: false,
      rightCollapsed: false,
      setWidth: (side, w) => set(side === 'left' ? { leftW: w } : { rightW: w }),
      toggleCollapsed: (side) => set(s => side === 'left' ? { leftCollapsed: !s.leftCollapsed } : { rightCollapsed: !s.rightCollapsed }),
    }),
    { name: 'faclon-dt-ui', version: 1 }
  )
)
