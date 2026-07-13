import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useProjectStore } from './store/projectStore'
import { useSceneStore } from './store/sceneStore'
import { useAIStore } from './store/aiStore'
import { resolveAndCompute } from './lib/unsResolve'
import { exchangeSSOToken, fetchUserMeta } from './lib/iosense'
import { HomeScreen } from './components/home/HomeScreen'
import { ComponentStudio } from './components/studio/ComponentStudio'
import { ComponentDetails } from './components/details/ComponentDetails'
import { ThumbnailFactory } from './components/home/ThumbnailFactory'
// import { UnsDebugPanel } from './components/UnsDebugPanel'   // TEMPORARY debug window (disabled)
import { DialogHost } from './components/dialogs'
import App from './App'

// App shell: switches between the Home launcher and the Editor with a crossfade.
// Owns first-run migration, re-hydration on reload, and autosave of the live
// editor doc back into the active project.
export default function Root() {
  const view = useProjectStore(s => s.view)

  // Dev-only automation hook: lets headless tooling (scripts/snap.mjs) create
  // projects and drive the camera for self-verification screenshots.
  useEffect(() => {
    if (import.meta.env.DEV) window.__dt = { ...(window.__dt || {}), project: useProjectStore, scene: useSceneStore }
  }, [])

  // First run: wrap any pre-existing scene into a project. If we reload straight
  // into the editor, re-hydrate the live doc from the active project (authoritative).
  // IOsense SSO: if ?token= is present, exchange it (one-time, 60s) for a Bearer
  // JWT, store it (and seed the UNS token), then strip it from the URL.
  useEffect(() => {
    const url = new URL(window.location.href)
    const ssoToken = url.searchParams.get('token')
    if (!ssoToken) return
    url.searchParams.delete('token')
    window.history.replaceState({}, '', url.toString())
    const ai = useAIStore.getState()
    exchangeSSOToken(ssoToken, ai.iosenseBaseUrl)
      .then(async ({ token, organisation, userId }) => {
        // One session powers everything: cloud projects AND the UNS browser/live-data poll.
        ai.setConfig({ iosenseJWT: token, iosenseOrg: organisation, iosenseUserId: userId, unsBrowseToken: token })
        try {
          const m = await fetchUserMeta({ jwt: token, base: ai.iosenseBaseUrl, org: organisation })
          ai.setConfig({ iosenseName: m.name, iosenseEmail: m.email, iosenseOrgName: m.orgName, ...(m.orgId ? { iosenseOrg: m.orgId } : {}), ...(m.userId ? { iosenseUserId: m.userId } : {}) })
        } catch { /* profile optional */ }
      })
      .catch(err => console.warn('[IOsense] SSO exchange failed:', err.message))
  }, [])

  useEffect(() => {
    const ps = useProjectStore.getState()
    ps.seedFromCurrentScene()
    // Per-tab session marker: present only across in-tab reloads (F5/Ctrl+R/hard
    // refresh all keep sessionStorage). Absent on a fresh open (new/reopened tab).
    // → fresh open lands on Home; a reload resumes wherever you were.
    const freshOpen = !sessionStorage.getItem('dt-session')
    sessionStorage.setItem('dt-session', '1')
    if (freshOpen) {
      if (ps.view !== 'home') useProjectStore.setState({ view: 'home' })
      return
    }
    if (ps.view === 'editor') {
      const p = ps.activeId && ps.projects[ps.activeId]
      if (p) { useSceneStore.getState().loadScene(p.scene); useProjectStore.getState().markSaved() }
      else useProjectStore.setState({ view: 'home' })
    }
  }, [])

  // Track unsaved SCENE edits (manual-save model). The undo history advances on
  // user edits but NOT on the live simulation, so this flags real changes only.
  useEffect(() => {
    const unsub = useSceneStore.subscribe(() => {
      const ps = useProjectStore.getState()
      if (ps.view === 'editor' && ps.activeId) ps.refreshDirty()
    })
    const warn = (e) => { if (useProjectStore.getState().dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => { unsub(); window.removeEventListener('beforeunload', warn) }
  }, [])

  // UNS live data — poll every bound parameter's canonical topic into its value
  // (no undo history) via the OFFICIAL resolveAndCompute API. The picker stores
  // topics canonical (uns:wsId://…:op); we pass them straight through. Uses the
  // SSO-exchanged session (unsBrowseToken). Errors are swallowed (token/expiry).
  useEffect(() => {
    const poll = async () => {
      const ai = useAIStore.getState()
      const token = ai.iosenseJWT || ai.unsBrowseToken   // one platform session powers UNS too
      if (!token) return
      const { objects, updateObject } = useSceneStore.getState()
      const items = []
      for (const o of Object.values(objects)) {
        const meta = o.paramMeta || {}
        for (const k in meta) {
          const t = meta[k]?.topic
          if (t && t.startsWith('uns:')) items.push({ key: `${o.id}::${k}`, topic: t, objId: o.id, param: k })
        }
      }
      if (!items.length) return
      try {
        const now = Date.now()
        // 30-day lookback: plant feeds can lag days; :last still returns the newest dp.
        const res = await resolveAndCompute({ token }, items, { startTime: now - 30 * 86_400_000, endTime: now })
        const byObj = {}
        for (const it of items) {
          const r = res[it.key]
          if (!r || r.error || r.value == null) continue
          const num = Number(r.value)
          ;(byObj[it.objId] ??= {})[it.param] = Number.isNaN(num) ? r.value : num
        }
        const objs = useSceneStore.getState().objects
        for (const [oid, params] of Object.entries(byObj)) {
          const o = objs[oid]; if (!o) continue
          updateObject(oid, { parameters: { ...o.parameters, ...params } })
        }
      } catch { /* ignore poll errors (token/expiry) */ }
    }
    const iv = setInterval(poll, 12000)
    poll()
    return () => clearInterval(iv)
  }, [])

  return (
    <>
      {/* Renders queued gallery thumbnails off-screen — mounted globally so a
          save from the editor (not just Home) captures a fresh thumbnail. */}
      <ThumbnailFactory />
      <AnimatePresence mode="wait">
      {view === 'home' ? (
        <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.26 }}>
          <HomeScreen />
        </motion.div>
      ) : view === 'studio' ? (
        <motion.div key="studio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
          <ComponentStudio />
        </motion.div>
      ) : view === 'details' ? (
        <motion.div key="details" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
          <ComponentDetails />
        </motion.div>
      ) : (
        <motion.div key="editor" initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
          <App />
        </motion.div>
      )}
      </AnimatePresence>
      {/* TEMPORARY: UNS live-data debug window (remove this line + the component file) */}
      {/* UNS debug window intentionally disabled for the demo twin */}
      {/* Global in-app confirm/alert host — native dialogs don't render in the platform iframe */}
      <DialogHost />
    </>
  )
}
