import { create } from 'zustand'
import { motion, AnimatePresence } from 'framer-motion'
import { C, R, glass, SHADOW } from '../ui/theme'

// ── Global in-app dialogs (promise-based window.confirm/alert replacement) ──
// Native dialogs are silently suppressed when the app runs inside the IOsense
// platform iframe (cross-origin) — confirm() returns false with NO UI, which
// made Bruce "keep your current scene" without ever asking. These render as
// real modals via <DialogHost/> (mounted once in Root) and resolve a Promise:
//   if (await confirmDialog({ title, body, confirmLabel, danger })) …
//   await alertDialog({ title, body })

const useDialogStore = create((set) => ({ req: null, _open: (req) => set({ req }) }))

const close = (val) => {
  const { req } = useDialogStore.getState()
  useDialogStore.setState({ req: null })
  req?.resolve(val)
}

export function confirmDialog({ title = 'Are you sure?', body = '', confirmLabel = 'Confirm', danger = false } = {}) {
  return new Promise((resolve) => useDialogStore.getState()._open({ kind: 'confirm', title, body, confirmLabel, danger, resolve }))
}
export function alertDialog({ title = 'Notice', body = '' } = {}) {
  return new Promise((resolve) => useDialogStore.getState()._open({ kind: 'alert', title, body, resolve }))
}

export function DialogHost() {
  const req = useDialogStore((s) => s.req)
  return (
    <AnimatePresence>
      {req && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => close(req.kind !== 'confirm')}
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(20,24,32,0.32)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}>
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }} onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(420px, 92vw)', borderRadius: R.lg, ...glass, border: `1px solid ${C.line}`, boxShadow: SHADOW.panel, padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{req.title}</h2>
            <p style={{ fontSize: 13.5, color: C.text2, marginTop: 8, lineHeight: 1.5, wordBreak: 'break-word' }}>{req.body}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
              {req.kind === 'confirm' && (
                <button onClick={() => close(false)} style={{ padding: '9px 16px', border: `1px solid ${C.line}`, borderRadius: R.sm, background: 'transparent', color: C.text2, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>Cancel</button>
              )}
              <button onClick={() => close(true)} autoFocus
                style={{ padding: '9px 18px', border: 'none', borderRadius: R.sm, background: req.danger ? C.bad : C.accent, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
                {req.kind === 'confirm' ? req.confirmLabel : 'OK'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
