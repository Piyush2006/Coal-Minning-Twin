// Shared "a side drawer is open" signal. Drawer components mark their presence
// while open; the Bruce floating button subscribes and hides itself so it never
// overlaps a panel. Counter (not boolean) so overlapping drawers compose.
import { useEffect } from 'react'
import { create } from 'zustand'

export const useDrawerPresence = create(() => ({ count: 0 }))

// Call from any drawer component: marks presence while `open` is true and
// releases automatically on close/unmount.
export function useMarkDrawer(open = true) {
  useEffect(() => {
    if (!open) return
    useDrawerPresence.setState(s => ({ count: s.count + 1 }))
    return () => useDrawerPresence.setState(s => ({ count: Math.max(0, s.count - 1) }))
  }, [open])
}
