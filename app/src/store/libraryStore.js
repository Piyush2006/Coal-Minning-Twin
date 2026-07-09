import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useSceneStore } from './sceneStore'
import { useAIStore } from './aiStore'
import { setLibraryComponents } from '../lib/libraryRef'
import { setCustomTypes } from '../lib/customTypesRef'
import { addInsightResult, fetchInsightResults } from '../lib/iosense'

// ─────────────────────────────────────────────────────────────────────────────
// Shared COMPONENT LIBRARY — custom asset types saved to the org's IOsense insight
// so they're available to everyone, in every project. Stored in the SAME insight
// as projects but as separate result docs tagged 'component' (tags namespace it).
// Each component's TYPE id is its stable cloud `key`, so versions supersede
// (newest-doc-per-key on pull — the platform's update endpoint is unreliable) and
// placements resolve across users. Components are MERGED into the live scene's
// customAssetTypes so they surface in the asset library everywhere.
// ─────────────────────────────────────────────────────────────────────────────

const cloudAuth = () => {
  const a = useAIStore.getState()
  if (!a.iosenseJWT || !a.insightId) return null
  return { jwt: a.iosenseJWT, base: a.iosenseBaseUrl, org: a.iosenseOrg, insightId: a.insightId, userID: a.iosenseUserId }
}

export const useLibraryStore = create(
  persist(
    (set, get) => ({
      components: {},          // { [typeId]: spec }
      deletedKeys: [],         // typeIds removed locally — hidden on every pull
      cloudBusy: false,
      cloudErr: null,
      lastSync: null,

      // Merge the library into the live scene so its types are placeable. Library
      // is the base; project-local types override by id.
      mergeIntoScene: () => {
        const lib = get().components
        setLibraryComponents(lib)
        useSceneStore.setState(s => {
          const merged = { ...lib, ...s.customAssetTypes }
          setCustomTypes(merged)
          return { customAssetTypes: merged }
        })
      },

      // Add/update a component locally + best-effort publish to the shared insight.
      publishComponent: async (id, spec) => {
        if (!id || !spec) return
        set(s => ({ components: { ...s.components, [id]: spec } }))
        get().mergeIntoScene()
        const auth = cloudAuth()
        if (!auth) return                       // offline — kept locally, publishes on reconnect
        set({ cloudBusy: true, cloudErr: null })
        try {
          await addInsightResult(auth, {
            insightID: auth.insightId, resultName: spec.label || 'Component',
            result: { key: id, spec, schemaVersion: 1 }, tags: ['component'], userID: auth.userID,
          })
          set({ cloudBusy: false, lastSync: Date.now() })
        } catch (e) {
          set({ cloudBusy: false, cloudErr: e.message })
        }
      },

      // Pull all shared components (newest doc per key), merge into the scene.
      pullComponents: async () => {
        const auth = cloudAuth()
        if (!auth) return { ok: false, reason: 'not-connected' }
        set({ cloudBusy: true, cloudErr: null })
        try {
          const { rows } = await fetchInsightResults(auth, auth.insightId, { count: 500 })
          const del = new Set(get().deletedKeys || [])
          const newest = {}   // key → { spec, ts }
          for (const doc of rows) {
            const tags = doc.tags || []
            if (!tags.includes('component')) continue
            const payload = doc.result || {}
            const key = payload.key || doc._id
            const spec = payload.spec
            if (!key || !spec || del.has(key)) continue
            const ts = (doc.updatedAt && Date.parse(doc.updatedAt)) || (doc.createdAt && Date.parse(doc.createdAt)) || 0
            if (!newest[key] || ts > newest[key].ts) newest[key] = { spec: { ...spec, id: key }, ts }
          }
          const components = {}
          for (const k in newest) components[k] = newest[k].spec
          set({ components, cloudBusy: false, lastSync: Date.now() })
          get().mergeIntoScene()
          return { ok: true, count: Object.keys(components).length }
        } catch (e) {
          set({ cloudBusy: false, cloudErr: e.message })
          return { ok: false, reason: e.message }
        }
      },

      removeComponent: (id) => set(s => {
        const { [id]: _, ...rest } = s.components
        const deletedKeys = [...new Set([...(s.deletedKeys || []), id])]
        setLibraryComponents(rest)
        return { components: rest, deletedKeys }
      }),
    }),
    {
      name: 'faclon-dt-library',
      version: 1,
      partialize: (s) => ({ components: s.components, deletedKeys: s.deletedKeys }),
      onRehydrateStorage: () => (state) => { if (state?.components) setLibraryComponents(state.components) },
    }
  )
)
