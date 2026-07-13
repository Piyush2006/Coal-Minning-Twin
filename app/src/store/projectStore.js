import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import { quotaSafeStorage, pruneProjectsState } from '../lib/safeStorage'
import { useSceneStore } from './sceneStore'
import { useAIStore } from './aiStore'
import { useLibraryStore } from './libraryStore'
import { useThumbStore } from './thumbStore'
import { addInsightResult, fetchInsightResults } from '../lib/iosense'
import { TEMPLATES } from '../lib/templates'

// ─────────────────────────────────────────────────────────────────────────────
// Project library — the multi-project layer on top of the single-scene editor.
// projectStore owns the SAVED projects; sceneStore is the live editor doc.
// Each project keeps its OWN chat. Saving is MANUAL: scene edits mark the project
// dirty; leaving with unsaved changes warns. (Chat persists immediately.)
//   project = { id, name, createdAt, updatedAt, scene:{…}, chat:[…] }
// ─────────────────────────────────────────────────────────────────────────────

const GREETING = { role: 'assistant', text: 'Describe what to build or change and I’ll do it — e.g. “add a third line of 4 reduction pots”.' }
const blankScene = () => ({ objects: {}, groups: {}, customAssetTypes: {}, flowLayout: {}, environment: {}, tour: {} })

// Saved projects carry their tour config from the day they were created —
// but the tour is app-authored presentation (no in-app editor), so a stale
// copy silently drops newer beats/actions. Template-derived scenes therefore
// refresh `tour` from the CURRENT template on every open.
export function freshTour(scene) {
  try {
    if (!scene?.objects) return scene
    for (const t of TEMPLATES) {
      const built = t.build?.()
      if (!built?.tour?.beats?.length) continue
      // same template family ⇔ the scene contains the template's anchor assets
      const ids = Object.keys(built.objects ?? {})
      if (!ids.length) continue
      const anchors = ids.slice(0, 6)
      const matches = anchors.filter(id => scene.objects[id]).length
      if (matches >= Math.min(4, anchors.length)) return { ...scene, tour: built.tour }
    }
  } catch { /* never block opening a project */ }
  return scene
}
const now = () => Date.now()

// Every new scene starts with a Floor — a real, selectable/editable object (size,
// color, finish, aisle lanes), not a hardcoded backdrop. loadScene back-fills its
// config from the schema, so a minimal record is enough here. order:-1 keeps it
// first in the namespace; layer 'structural' so it toggles with structure.
const defaultFloorObject = () => ({
  fl_floor: {
    id: 'fl_floor', type: 'Floor', name: 'Floor',
    position: [0, -0.02, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    layer: 'structural', parentId: null, order: -1,
    connections: [], dataBindings: [], config: {}, parameters: {}, rules: [],
    locked: false, visible: true,
  },
})

// Everything already in the insight was created during setup by Arsh; legacy docs
// (and pre-attribution local projects) are credited to him.
const ARSH = { id: 'arsh.b@iosense.io', name: 'Arsh Bajaj' }

// Who is creating right now — the connected IOsense account, or null when offline.
// Creator id is the email (e.g. arsh.b@iosense.io); stamped once and never changed.
const currentCreator = () => {
  const a = useAIStore.getState()
  if (!a.iosenseJWT || !a.iosenseEmail) return null
  return { id: a.iosenseEmail, name: a.iosenseName || a.iosenseEmail }
}

function makeProject(name, scene, createdBy = currentCreator()) {
  const id = `prj_${nanoid(8)}`
  const t = now()
  // cloudKey = stable cross-version identity. Each cloud save writes a NEW result
  // doc (the update endpoint is unusable); pull keeps the newest doc per cloudKey,
  // so versions supersede instead of duplicating.
  return { id, name: name || 'Untitled Project', createdAt: t, updatedAt: t, scene: { ...blankScene(), ...scene }, chat: [GREETING], cloudId: null, cloudKey: `key_${nanoid(10)}`, createdBy: createdBy ?? null }
}

// IOsense cloud target — present only when an account is connected AND a target
// insight is chosen. Everything cloud-related no-ops when this returns null, so
// the app works fully offline (localStorage stays the cache).
const cloudAuth = () => {
  const a = useAIStore.getState()
  if (!a.iosenseJWT || !a.insightId) return null
  return { jwt: a.iosenseJWT, base: a.iosenseBaseUrl, org: a.iosenseOrg, insightId: a.insightId, userID: a.iosenseUserId }
}
// One result doc per project: result holds the whole project payload.
const toResult = (p) => ({ scene: p.scene, chat: p.chat ?? [GREETING], name: p.name, createdBy: p.createdBy ?? null, projectKey: p.cloudKey ?? null, schemaVersion: 1 })

const hydrate = (scene) => useSceneStore.getState().loadScene(scene)
// New projects open straight into build mode so you can start editing/arranging.
const openInBuild = () => useSceneStore.getState().setEditMode(true)
// Templates open in VIEW mode — you land on a populated, running scene first.
const openInView = () => useSceneStore.getState().setEditMode(false)
// Edit signature from the undo history — changes on user edits, NOT on the live
// simulation (which never touches history), so dirty reflects real changes only.
const editSig = () => { const s = useSceneStore.getState(); return `${s._historyIndex}:${s._history.length}` }

export const useProjectStore = create(
  persist(
    (set, get) => ({
      projects: {},
      activeId: null,
      view: 'home',           // 'home' | 'editor'
      dirty: false,           // unsaved SCENE edits in the active project
      _savedSig: null,        // editSig() at last save / open
      _dirtyOverride: false,  // forces dirty for programmatic loads (chatbot /
                              // template / import) that RESET the undo history —
                              // those don't change editSig, so the signature check
                              // alone would miss them. Cleared on save / open.
      provisionalId: null,    // a blank project that exists only for editing — NOT
                              // committed to the library until explicitly saved. If
                              // you leave without saving, it's discarded (no empty
                              // "Untitled Project" left behind).
      // ── IOsense cloud sync (best-effort; null target ⇒ offline) ──
      cloudBusy: false,       // a pull/push is in flight
      cloudErr: null,         // last cloud error message (surfaced, non-fatal)
      lastSync: null,         // ts of last successful pull/push
      deletedCloudIds: [],    // cloud _ids deleted locally — never re-imported
      deletedKeys: [],        // cloudKeys deleted locally — every version stays hidden

      // ── create / open ──
      createBlank: (name = 'Untitled Project') => {
        const p = makeProject(name, { objects: { ...defaultFloorObject() } })
        // Provisional: exists only so you can edit. Discarded on leaving unless saved.
        set(s => ({ projects: { ...s.projects, [p.id]: p }, provisionalId: p.id }))
        get().openProject(p.id)
        openInBuild()
        return p.id
      },

      createFromTemplate: (templateId, name) => {
        const t = TEMPLATES.find(x => x.id === templateId)
        if (!t) return null
        const built = t.build() || {}
        // Templates that declare their own ground (environment.ground — outdoor /
        // terrain scenes) skip the default indoor Floor slab.
        const baseObjects = built.environment?.ground ? {} : defaultFloorObject()
        const p = makeProject(name || t.name, {
          objects: { ...baseObjects, ...(built.objects ?? built) },
          groups: built.groups ?? {}, customAssetTypes: built.customAssetTypes ?? {},
          flowLayout: built.flowLayout ?? {}, environment: built.environment ?? {}, tour: built.tour ?? {},
        })
        set(s => ({ projects: { ...s.projects, [p.id]: p } }))
        get().openProject(p.id)
        openInView()        // land in view mode on the populated scene
        get().markDirty()   // a fresh template is unsaved until you choose to save
        return p.id
      },

      // scene = validated snapshot {objects,groups,customAssetTypes,flowLayout}
      createFromScene: (name, scene) => {
        const p = makeProject(name, scene)
        set(s => ({ projects: { ...s.projects, [p.id]: p } }))
        get().openProject(p.id)
        openInBuild()
        get().markDirty()   // imported / generated scene is unsaved until you save
        return p.id
      },

      openProject: (id) => {
        const p = get().projects[id]
        if (!p) return
        hydrate(freshTour(p.scene))
        set({ activeId: id, view: 'editor', dirty: false, _dirtyOverride: false, _savedSig: editSig() })
      },

      // ── manual save ──
      saveActiveScene: () => {
        const { activeId, projects } = get()
        if (!activeId || !projects[activeId]) return
        const scene = useSceneStore.getState().getSceneSnapshot()
        const t = now()
        set(s => ({ projects: { ...s.projects, [activeId]: { ...s.projects[activeId], scene, updatedAt: t } }, dirty: false, _dirtyOverride: false, _savedSig: editSig(),
          provisionalId: s.provisionalId === activeId ? null : s.provisionalId }))   // saving commits it for real
        // Refresh the gallery thumbnail from the just-saved scene (sig === updatedAt,
        // matching ProjectCard). The globally-mounted ThumbnailFactory captures it.
        if (Object.keys(scene?.objects ?? {}).length) {
          useThumbStore.getState().enqueue({ id: activeId, scene, sig: String(t) })
        }
        // NOTE: local-only. Pushing to the cloud is an explicit choice — the UI
        // prompts "Save to cloud?" after save and calls cloudPush() on confirm.
      },

      // Mark current edit state as the saved baseline (no write) — used after load.
      markSaved: () => set({ dirty: false, _dirtyOverride: false, _savedSig: editSig() }),
      // Force the project dirty for changes the history signature can't see
      // (chatbot generate, template, import — they reset the undo history).
      markDirty: () => set(s => (s.activeId ? { dirty: true, _dirtyOverride: true } : {})),
      // Recompute dirty from the live edit signature (called by Root's subscriber).
      // The override keeps programmatic loads dirty even though editSig is unchanged.
      refreshDirty: () => set(s => { const d = s._dirtyOverride || (editSig() !== s._savedSig); return d === s.dirty ? {} : { dirty: d } }),

      // Leave to the launcher. A still-provisional project (a blank you never saved)
      // is discarded here, so an untouched "New Project" never lingers in the library.
      goHome: () => set(s => {
        const pid = s.provisionalId
        if (pid && s.projects[pid]) {
          const { [pid]: _, ...rest } = s.projects
          return { view: 'home', provisionalId: null, projects: rest, activeId: s.activeId === pid ? null : s.activeId }
        }
        return { view: 'home', provisionalId: null }
      }),

      // ── library management ──
      renameProject: (id, name) => set(s => s.projects[id]
        ? { projects: { ...s.projects, [id]: { ...s.projects[id], name: name || 'Untitled Project', updatedAt: now() } } } : {}),

      duplicateProject: (id) => {
        const src = get().projects[id]
        if (!src) return null
        const p = makeProject(`${src.name} copy`, JSON.parse(JSON.stringify(src.scene)))
        set(s => ({ projects: { ...s.projects, [p.id]: p } }))
        return p.id
      },

      deleteProject: (id) => {
        const p = get().projects[id]
        set(s => {
          const { [id]: _, ...rest } = s.projects
          // Hide every cloud version of this project by its stable cloudKey (no server
          // delete endpoint exists), plus the specific doc id for legacy safety.
          const dc = p?.cloudId ? [...new Set([...(s.deletedCloudIds || []), p.cloudId])] : (s.deletedCloudIds || [])
          const dk = p?.cloudKey ? [...new Set([...(s.deletedKeys || []), p.cloudKey])] : (s.deletedKeys || [])
          return { projects: rest, activeId: s.activeId === id ? null : s.activeId, deletedCloudIds: dc, deletedKeys: dk }
        })
      },

      // ── IOsense cloud sync ──
      // Push a project up. The platform's update endpoint is unusable, so a save
      // always writes a FRESH result doc (carrying the project's stable cloudKey);
      // pull keeps only the newest doc per cloudKey, so the new doc supersedes the
      // old one rather than duplicating it. Best-effort — surfaces errors, never throws.
      cloudPush: async (id) => {
        const auth = cloudAuth()
        if (!auth) return
        const p = get().projects[id]
        if (!p) return
        set({ cloudBusy: true, cloudErr: null })
        try {
          const created = await addInsightResult(auth, { insightID: auth.insightId, resultName: p.name, result: toResult(p), tags: ['digital-twin'], userID: auth.userID })
          const cid = created?._id
          set(s => (s.projects[id]
            ? { projects: { ...s.projects, [id]: { ...s.projects[id], cloudId: cid || s.projects[id].cloudId } }, cloudBusy: false, lastSync: now() }
            : { cloudBusy: false, lastSync: now() }))
          // Also publish this project's custom components to the shared library, so
          // saving to cloud propagates all associated new components for reuse.
          const types = p.scene?.customAssetTypes || {}
          for (const tid in types) { try { await useLibraryStore.getState().publishComponent(tid, types[tid]) } catch { /* best-effort */ } }
        } catch (e) {
          set({ cloudBusy: false, cloudErr: e.message })
        }
      },

      // Pull projects from the insight. LOCAL-FIRST + ADD-ONLY: group docs by their
      // stable projectKey, keep the NEWEST doc per key, and only ADD keys we don't
      // already have locally. Never overwrites/clobbers a local project. Skips
      // deleted (by key or id), test, and empty docs.
      cloudPull: async () => {
        const auth = cloudAuth()
        if (!auth) return { ok: false, reason: 'not-connected' }
        set({ cloudBusy: true, cloudErr: null })
        try {
          const { rows } = await fetchInsightResults(auth, auth.insightId, { count: 500 })
          const { projects, deletedCloudIds, deletedKeys } = get()
          const delIds = new Set(deletedCloudIds || [])
          const delKeys = new Set(deletedKeys || [])
          // newest doc per projectKey (legacy docs without a key group under their own _id)
          const groups = {}
          for (const doc of rows) {
            const cid = doc?._id
            if (!cid) continue
            const tags = doc.tags || []
            if (tags.includes('deleted') || tags.includes('__test__')) continue
            if (tags.length && !tags.includes('digital-twin')) continue
            const payload = doc.result || {}
            const scene = { ...blankScene(), ...(payload.scene || {}) }
            if (Object.keys(scene.objects || {}).length === 0) continue
            const key = payload.projectKey || cid
            const ts = (doc.updatedAt && Date.parse(doc.updatedAt)) || (doc.createdAt && Date.parse(doc.createdAt)) || 0
            if (!groups[key] || ts > groups[key].ts) groups[key] = { doc, payload, scene, ts, cid, key }
          }
          const knownKeys = new Set(Object.values(projects).map(p => p.cloudKey).filter(Boolean))
          const knownCloudIds = new Set(Object.values(projects).map(p => p.cloudId).filter(Boolean))
          const next = { ...projects }
          let added = 0
          for (const g of Object.values(groups)) {
            if (delKeys.has(g.key) || delIds.has(g.cid)) continue
            if (knownKeys.has(g.key) || knownCloudIds.has(g.cid)) continue   // already have this project
            const name = g.doc.resultName || g.payload.name || 'Untitled Project'
            const updatedAt = g.ts || now()
            const createdAt = (g.doc.createdAt && Date.parse(g.doc.createdAt)) || updatedAt
            const chat = Array.isArray(g.payload.chat) ? g.payload.chat : [GREETING]
            const createdBy = g.payload.createdBy || ARSH   // legacy docs → Arsh
            const lid = `prj_${nanoid(8)}`
            next[lid] = { id: lid, name, createdAt, updatedAt, scene: g.scene, chat, cloudId: g.cid, cloudKey: g.key, createdBy }
            added++
          }
          set({ projects: next, cloudBusy: false, lastSync: now() })
          return { ok: true, added, updated: 0, total: rows.length }
        } catch (e) {
          set({ cloudBusy: false, cloudErr: e.message })
          return { ok: false, reason: e.message }
        }
      },

      // ── per-project chat (isolated; persists immediately) ──
      // extra.thumbs: small image data-URLs shown in the bubble (persisted; the
      // full-size images are transient and never stored).
      addChatMessage: (role, text, extra) => set(s => {
        const id = s.activeId, p = s.projects[id]
        if (!p) return {}
        const msg = { role, text, ...(extra?.thumbs?.length ? { thumbs: extra.thumbs.slice(0, 4) } : {}) }
        return { projects: { ...s.projects, [id]: { ...p, chat: [...(p.chat ?? [GREETING]), msg] } } }
      }),
      clearChat: () => set(s => {
        const id = s.activeId, p = s.projects[id]
        if (!p) return {}
        return { projects: { ...s.projects, [id]: { ...p, chat: [GREETING] } } }
      }),

      // First-run: wrap any pre-existing single scene into a project so no work is lost.
      seedFromCurrentScene: () => {
        if (Object.keys(get().projects).length > 0) return
        const snap = useSceneStore.getState().getSceneSnapshot()
        if (Object.keys(snap.objects || {}).length === 0) return
        const p = makeProject('My Project', snap)
        set(s => ({ projects: { ...s.projects, [p.id]: p } }))
      },
    }),
    {
      name: 'faclon-dt-projects',
      version: 3,
      // v2: attribute pre-existing projects to Arsh. v3: give each a stable cloudKey.
      migrate: (state) => {
        if (state?.projects) {
          for (const p of Object.values(state.projects)) {
            if (p && !p.createdBy) p.createdBy = ARSH
            if (p && !p.cloudKey) p.cloudKey = `key_${nanoid(10)}`
          }
        }
        return state
      },
      partialize: (s) => ({ projects: s.projects, activeId: s.activeId, view: s.view, deletedCloudIds: s.deletedCloudIds, deletedKeys: s.deletedKeys }),
      // chat thumbs can blow the ~5 MB localStorage budget — prune + retry instead of dying
      storage: createJSONStorage(() => quotaSafeStorage({ prune: pruneProjectsState })),
    }
  )
)
