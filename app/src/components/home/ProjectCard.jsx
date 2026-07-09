import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { renderSchematic } from '../../lib/thumbnail'
import { exportSpec, downloadJSON } from '../../lib/twinSpec'
import { useThumbStore } from '../../store/thumbStore'
import { C, R, SHADOW } from '../../ui/theme'

function relativeTime(ts) {
  const diff = Date.now() - ts, m = 60000, h = 3.6e6, d = 8.64e7
  if (diff < m) return 'just now'
  if (diff < h) return `${Math.floor(diff / m)}m ago`
  if (diff < d) return `${Math.floor(diff / h)}h ago`
  if (diff < 7 * d) return `${Math.floor(diff / d)}d ago`
  return new Date(ts).toLocaleDateString()
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
}

export function ProjectCard({ project, onOpen, onRename, onDuplicate, onDelete }) {
  const [menu, setMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(project.name)

  const assetCount = Object.keys(project.scene?.objects ?? {}).length
  // Real 3D thumbnail (rendered in the background) with the 2D schematic as the
  // instant fallback. sig invalidates the cached image whenever the project changes.
  const sig = String(project.updatedAt)
  const cached = useThumbStore(s => s.cache[project.id])
  const enqueue = useThumbStore(s => s.enqueue)
  const schematic = useMemo(() => renderSchematic(project.scene, { w: 520, h: 300 }), [project.scene, project.updatedAt])
  const thumb = (assetCount > 0 && cached?.sig === sig) ? cached.url : schematic
  useEffect(() => {
    if (assetCount > 0 && cached?.sig !== sig) enqueue({ id: project.id, scene: project.scene, sig })
  }, [project.id, sig, assetCount]) // eslint-disable-line react-hooks/exhaustive-deps

  const commitName = () => { setEditing(false); const n = name.trim(); if (n && n !== project.name) onRename(n) }
  const exportJSON = () => { setMenu(false); downloadJSON(exportSpec(project.scene, { title: project.name }), project.name) }

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -5 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      onClick={() => !editing && onOpen(project.id)}
      style={{
        position: 'relative', cursor: 'pointer', borderRadius: R.lg, overflow: 'hidden',
        background: C.surface, border: `1px solid ${C.line}`, boxShadow: SHADOW.card,
      }}
    >
      {/* thumbnail */}
      <div style={{ position: 'relative', aspectRatio: '16 / 9', overflow: 'hidden', borderBottom: `1px solid ${C.line}` }}>
        <img src={thumb} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        {/* where the project lives: synced to the cloud insight, or local-only */}
        <span title={project.cloudId ? 'Saved to your IOsense insight' : 'Stored on this device only'}
          style={{ position: 'absolute', top: 8, left: 8, display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 8px', borderRadius: R.pill, fontSize: 10.5, fontWeight: 600, letterSpacing: 0.2,
            background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            color: project.cloudId ? C.accent : C.text2, border: `1px solid ${C.line}`, boxShadow: SHADOW.card }}>
          {project.cloudId ? '☁ Cloud' : '○ Local'}
        </span>
      </div>

      {/* footer */}
      <div style={{ padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {editing ? (
            <input autoFocus value={name} onClick={(e) => e.stopPropagation()}
              onChange={(e) => setName(e.target.value)} onBlur={commitName}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setName(project.name); setEditing(false) } }}
              style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: C.text,
                border: `1px solid ${C.accent}`, borderRadius: 6, padding: '2px 6px', outline: 'none' }} />
          ) : (
            <p style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</p>
          )}
          <p style={{ fontSize: 11.5, color: C.text3, marginTop: 2 }}>{assetCount} asset{assetCount === 1 ? '' : 's'} · {relativeTime(project.updatedAt)}</p>
          <p style={{ fontSize: 11.5, color: C.text3, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Created by {project.createdBy?.name || 'NA'}</p>
        </div>

        <button onClick={(e) => { e.stopPropagation(); setMenu(m => !m) }} title="More"
          style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer',
            background: menu ? C.accentSoft : 'transparent', color: C.text2, fontSize: 16, lineHeight: 1 }}>⋯</button>

        {menu && (
          <>
            <div onClick={(e) => { e.stopPropagation(); setMenu(false) }} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.12 }} onClick={(e) => e.stopPropagation()}
              style={{ position: 'absolute', right: 12, bottom: 46, zIndex: 41, minWidth: 150, padding: 5,
                background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.md, boxShadow: SHADOW.panel }}>
              {[
                ['Open', () => onOpen(project.id)],
                ['Rename', () => { setMenu(false); setEditing(true) }],
                ['Duplicate', () => { setMenu(false); onDuplicate(project.id) }],
                ['Export JSON', exportJSON],
                ['Delete', () => { setMenu(false); onDelete(project.id) }, true],
              ].map(([label, fn, danger]) => (
                <button key={label} onClick={(e) => { e.stopPropagation(); fn() }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none',
                    background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, borderRadius: 6,
                    color: danger ? C.bad : C.text }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = danger ? 'rgba(255,59,48,0.08)' : 'rgba(0,0,0,0.04)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>{label}</button>
              ))}
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  )
}
