import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { TEMPLATES } from '../../lib/templates'
import { renderSchematic } from '../../lib/thumbnail'
import { useThumbStore } from '../../store/thumbStore'
import { C, R, glass, SHADOW } from '../../ui/theme'

// Real 3D preview (rendered in the background by ThumbnailFactory) with the 2D
// schematic as the instant fallback. Templates are static, so the sig is constant.
function TemplateThumb({ id, build }) {
  const scene = useMemo(() => {
    try { const b = build() || {}; return { objects: b.objects ?? b, groups: b.groups ?? {}, customAssetTypes: {} } }
    catch { return { objects: {} } }
  }, [build])
  const schematic = useMemo(() => { try { return renderSchematic(scene, { w: 440, h: 230 }) } catch { return null } }, [scene])
  const cacheId = `tmpl:${id}`, sig = 'tmpl'
  const cached = useThumbStore(s => s.cache[cacheId])
  const enqueue = useThumbStore(s => s.enqueue)
  const hasObjects = Object.keys(scene.objects || {}).length > 0
  useEffect(() => {
    if (hasObjects && cached?.sig !== sig) enqueue({ id: cacheId, scene, sig })
  }, [cacheId, hasObjects]) // eslint-disable-line react-hooks/exhaustive-deps
  const src = (hasObjects && cached?.sig === sig) ? cached.url : schematic
  return <img src={src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
}

export function TemplatePicker({ onPick, onClose }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(20,24,32,0.28)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }} onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(880px, 92vw)', maxHeight: '84vh', overflowY: 'auto', borderRadius: R.lg,
          ...glass, border: `1px solid ${C.line}`, boxShadow: SHADOW.panel, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text }}>Start from a template</h2>
            <p style={{ fontSize: 13, color: C.text2, marginTop: 3 }}>Pick a starting layout — you can change everything after.</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {TEMPLATES.map(t => (
            <motion.div key={t.id} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              onClick={() => onPick(t.id)}
              style={{ cursor: 'pointer', borderRadius: R.md, overflow: 'hidden', background: C.surface,
                border: `1px solid ${C.line}`, boxShadow: SHADOW.card }}>
              <div style={{ aspectRatio: '16 / 9', borderBottom: `1px solid ${C.line}` }}><TemplateThumb id={t.id} build={t.build} /></div>
              <div style={{ padding: '11px 13px' }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{t.name}</p>
                <p style={{ fontSize: 12, color: C.text3, marginTop: 3, lineHeight: 1.4 }}>{t.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
