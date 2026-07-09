import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useSceneStore } from '../../store/sceneStore'
import { useStudioStore } from '../../store/studioStore'
import { useAIStore } from '../../store/aiStore'
import { MACHINE_LIBRARY, groupCustomTypes } from '../../lib/machineLibrary'
import { validateComponentSpec } from '../../lib/componentSpec'
import { ComponentGlyph } from '../ComponentGlyph'
import { C, R, glass, SHADOW } from '../../ui/theme'

// Component library as a modal (opened by the ⊞ Components button). Click a tile
// to drop it into the scene; stays open so you can add several.
export function AssetLibraryModal({ onClose }) {
  const { addObject, addCustomAssetType, customAssetTypes, setFlowNodePosition } = useSceneStore()
  const openNew = useStudioStore(s => s.openNew)
  const openEdit = useStudioStore(s => s.openEdit)
  const setConfig = useAIStore(s => s.setConfig)
  const [query, setQuery] = useState('')
  const [added, setAdded] = useState(null)        // last-added label (brief flash)
  const [err, setErr] = useState('')
  const fileRef = useRef()

  const randPos = () => [(Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8]
  const seedFlow = (id) => {
    const n = Object.keys(useSceneStore.getState().objects).length
    setFlowNodePosition(id, { x: 40 + (n * 46) % 460, y: 40 + Math.floor((n * 46) / 460) * 130 })
  }
  const place = (type, layer, label) => { const id = addObject(type, randPos(), layer); seedFlow(id); setAdded(label); setTimeout(() => setAdded(null), 1400) }
  const buildNew = () => { onClose(); openNew() }              // open the full-screen Studio
  const editType = (id) => { onClose(); openEdit(id) }
  // Describe to Bruce: seed the chat input + close so the assistant (right panel) is in view.
  const describeToBruce = () => { setConfig({ chatSeed: 'Create a component: ' }); onClose() }
  // Import a Component Spec JSON → validate → register → open in the Studio to confirm.
  const importFile = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    try {
      const raw = JSON.parse(await file.text())
      const res = validateComponentSpec(raw.spec ?? raw)
      if (!res.ok) { setErr(res.errors[0] || 'Invalid component file.'); return }
      const id = addCustomAssetType(res.spec)
      onClose(); openEdit(id)
    } catch (e2) { setErr(`Couldn't read that file: ${e2.message}`) }
  }

  const q = query.toLowerCase().trim()
  const match = (l) => !q || l.toLowerCase().includes(q)

  const tile = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    padding: '10px 12px', borderRadius: R.md, background: C.surface, border: `1px solid ${C.line}`,
    cursor: 'pointer', fontSize: 13, color: C.text,
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(20,24,32,0.3)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }} onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(860px, 92vw)', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          borderRadius: R.lg, ...glass, border: `1px solid ${C.line}`, boxShadow: SHADOW.panel }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${C.line}` }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Components</h2>
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search components…"
            style={{ flex: 1, padding: '8px 12px', border: `1px solid ${C.line}`, borderRadius: R.sm, fontFamily: 'inherit', fontSize: 13, color: C.text, background: C.surface, outline: 'none' }} />
          {added && <span style={{ fontSize: 12.5, color: C.good, fontWeight: 600 }}>Added {added} ✓</span>}
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        {/* body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 20px' }}>
          {MACHINE_LIBRARY.map(({ category, items }) => {
            const shown = items.filter(it => match(it.label))
            if (!shown.length) return null
            return (
              <div key={category} style={{ marginTop: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: C.text3, marginBottom: 8 }}>{category}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                  {shown.map(it => (
                    <motion.div key={it.type} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} style={tile}
                      onClick={() => place(it.type, it.layer, it.label)}>
                      <ComponentGlyph type={it.type} />
                      <span style={{ flex: 1 }}>{it.label}</span>
                      <span style={{ color: C.accent, fontSize: 17, lineHeight: 1 }}>＋</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* custom asset creator */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.line}` }}>
            {groupCustomTypes(customAssetTypes, match).map(({ category, items }) => (
              <div key={category}>
                <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: C.text3, marginBottom: 8 }}>{category}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
                  {items.map(ct => (
                    <motion.div key={ct.id} whileHover={{ y: -2 }} style={tile} onClick={() => place(ct.id, ct.layer, ct.label)}>
                      <ComponentGlyph type={ct.parts ? 'box' : ct.primitive === 'cylinder' ? 'PipeSegment' : ct.primitive === 'tank' ? 'Tank' : 'box'} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ct.label}</span>
                      <button onClick={(e) => { e.stopPropagation(); editType(ct.id) }} title="Edit in Studio"
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.text3, fontSize: 13, padding: 2 }}>✎</button>
                      <span style={{ color: C.accent, fontSize: 17 }}>＋</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: C.text3, marginBottom: 8 }}>Add a component</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { label: '＋ Build', sub: 'Studio', onClick: buildNew },
                { label: '✨ Describe to Bruce', sub: 'AI', onClick: describeToBruce },
                { label: '⭳ Import JSON', sub: 'file', onClick: () => fileRef.current?.click() },
              ].map(o => (
                <button key={o.label} onClick={o.onClick}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, padding: '9px 14px', border: `1px dashed ${C.lineStrong}`, borderRadius: R.sm, background: 'transparent', color: C.text2, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
                  <span>{o.label}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 500, color: C.text3 }}>{o.sub}</span>
                </button>
              ))}
            </div>
            {err && <p style={{ fontSize: 12, color: C.bad, marginTop: 8 }}>{err}</p>}
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={importFile} style={{ display: 'none' }} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
