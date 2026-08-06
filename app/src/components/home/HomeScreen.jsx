import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useProjectStore } from '../../store/projectStore'
import { useAIStore } from '../../store/aiStore'
import { useLibraryStore } from '../../store/libraryStore'
import { HeroTwin } from './HeroTwin'
import { ProjectCard } from './ProjectCard'
import { TemplatePicker } from './TemplatePicker'
import { SettingsModal } from '../ai/SettingsModal'
import { confirmDialog } from '../dialogs'
import { validateSpec } from '../../lib/twinSpec'
import { FONT, C, R, glass, SHADOW } from '../../ui/theme'

const ICONS = { blank: '＋', template: '▦', upload: '↑' }
// Faclon Labs brand mark (favicon + home header).
const FACLON_LOGO = '/faclon-logo.jpeg'

function CTA({ icon, title, sub, onClick, primary }) {
  return (
    <motion.button whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }} onClick={onClick}
      style={{
        flex: 1, minWidth: 200, textAlign: 'left', cursor: 'pointer', padding: '18px 20px',
        borderRadius: R.lg, border: `1px solid ${primary ? 'transparent' : C.line}`,
        background: primary ? `linear-gradient(135deg, ${C.accent}, #5ac8fa)` : C.surface,
        color: primary ? '#fff' : C.text, boxShadow: SHADOW.card, fontFamily: FONT,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center',
        fontSize: 20, background: primary ? 'rgba(255,255,255,0.18)' : C.accentSoft, color: primary ? '#fff' : C.accent }}>{icon}</span>
      <span>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{title}</span>
        <span style={{ display: 'block', fontSize: 12.5, opacity: 0.8, marginTop: 2 }}>{sub}</span>
      </span>
    </motion.button>
  )
}

export function HomeScreen() {
  const { projects, createBlank, createFromTemplate, createFromScene, openProject, renameProject, duplicateProject, deleteProject, cloudPull } = useProjectStore()
  const cloudBusy = useProjectStore(s => s.cloudBusy)
  const lastSync = useProjectStore(s => s.lastSync)
  const cloudConnected = useAIStore(s => !!(s.iosenseJWT && s.insightId))
  const insightId = useAIStore(s => s.insightId)
  const iosenseJWT = useAIStore(s => s.iosenseJWT)
  const iosenseName = useAIStore(s => s.iosenseName)
  const iosenseEmail = useAIStore(s => s.iosenseEmail)
  const [picker, setPicker] = useState(false)
  const [settings, setSettings] = useState(false)
  const [toast, setToast] = useState(null)   // { type:'ok'|'err', msg }
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')   // 'all' | 'cloud' | 'local'
  const [mineOnly, setMineOnly] = useState(false)
  const fileRef = useRef()

  // Account avatar: initials of the signed-in name (Arsh Bajaj → AB); 'DT' when not.
  const initials = iosenseJWT
    ? (iosenseName || iosenseEmail || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || (iosenseEmail || '?').slice(0, 2).toUpperCase()
    : 'DT'

  const list = Object.values(projects).sort((a, b) => b.updatedAt - a.updatedAt)
  const q = query.trim().toLowerCase()
  const filtered = list.filter(p => {
    if (filter === 'cloud' && !p.cloudId) return false
    if (filter === 'local' && p.cloudId) return false
    // "my projects": signed-in → matched by email; signed-out → the unattributed (local) ones.
    if (mineOnly && (iosenseJWT ? p.createdBy?.id !== iosenseEmail : !!p.createdBy?.id)) return false
    if (q && !p.name.toLowerCase().includes(q)) return false
    return true
  })
  const flash = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4200) }

  // Make the persisted shared library available offline on mount, too.
  useEffect(() => { useLibraryStore.getState().mergeIntoScene() }, [])

  // Pull cloud projects + the shared component library whenever connected.
  useEffect(() => {
    if (!cloudConnected) return
    cloudPull().then(r => { if (r && !r.ok && r.reason !== 'not-connected') flash('err', `Cloud sync: ${r.reason}`) })
    useLibraryStore.getState().pullComponents()
  }, [cloudConnected, insightId, iosenseJWT])

  const refresh = async () => {
    const r = await cloudPull()
    useLibraryStore.getState().pullComponents()
    if (r?.ok) flash('ok', `Synced · ${r.added} new, ${r.updated} updated`)
    else if (r && r.reason !== 'not-connected') flash('err', `Cloud sync: ${r.reason}`)
  }

  const onUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const raw = JSON.parse(await file.text())
      const res = validateSpec(raw)
      if (!res.ok) { flash('err', res.errors[0] || 'Invalid Twin Spec.'); return }
      const name = res.meta?.title || file.name.replace(/\.json$/i, '')
      if (res.warnings.length) flash('ok', `Imported with notes: ${res.warnings[0]}`)
      createFromScene(name, res.scene)   // opens the editor
    } catch (err) {
      flash('err', `Could not parse JSON: ${err.message}`)
    }
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflowY: 'auto', background: C.bg, color: C.text, fontFamily: FONT }}>
      <input ref={fileRef} type="file" accept="application/json,.json" onChange={onUpload} style={{ display: 'none' }} />

      {/* Dashboard — navigates to the (in-progress) analytics dashboard */}
      <button onClick={() => { window.location.hash = '#/dashboard' }} title="Open dashboard"
        style={{ position: 'fixed', top: 18, right: 140, zIndex: 50, display: 'inline-flex', alignItems: 'center', gap: 7,
          height: 36, padding: '0 14px', borderRadius: R.pill, ...glass, border: `1px solid ${C.line}`, boxShadow: SHADOW.card,
          color: C.text2, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600 }}>
        <span style={{ fontSize: 15 }}>📊</span> Dashboard
      </button>

      {/* Settings (AI model + key) */}
      <button onClick={() => setSettings(true)} title="AI settings"
        style={{ position: 'fixed', top: 18, right: 22, zIndex: 50, display: 'inline-flex', alignItems: 'center', gap: 7,
          height: 36, padding: '0 14px', borderRadius: R.pill, ...glass, border: `1px solid ${C.line}`, boxShadow: SHADOW.card,
          color: C.text2, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600 }}>
        <span style={{ fontSize: 15 }}>⚙</span> Settings
      </button>
      <AnimatePresence>{settings && <SettingsModal onClose={() => setSettings(false)} />}</AnimatePresence>

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 28px 64px' }}>

        {/* ── Hero header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, minHeight: 300, paddingTop: 28 }}>
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <img src={FACLON_LOGO} alt="Faclon Labs" width={26} height={26} style={{ borderRadius: 7, display: 'block' }} />
              <span style={{ fontSize: 15, fontWeight: 600, color: C.text2 }}>Digital Twin Workbench</span>
            </div>
            <h1 style={{ fontSize: 42, lineHeight: 1.08, fontWeight: 700, letterSpacing: -0.5, color: C.text, maxWidth: 520 }}>
              Build a living model of your shopfloor.
            </h1>
            <p style={{ fontSize: 16, color: C.text2, marginTop: 14, maxWidth: 440, lineHeight: 1.5 }}>
              Start from scratch, pick a template, or import a generated layout — then design, simulate and explore in 3D.
            </p>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }}
            style={{ width: 'min(46%, 460px)', height: 300, flexShrink: 0 }}>
            <HeroTwin />
          </motion.div>
        </div>

        {/* ── CTAs ── */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
          <CTA primary icon={ICONS.blank} title="New Project" sub="Start with a blank canvas" onClick={() => createBlank()} />
          <CTA icon={ICONS.template} title="From Template" sub="Potline, bottling lines & more" onClick={() => setPicker(true)} />
          <CTA icon={ICONS.upload} title="Upload JSON" sub="Import a generated Twin Spec" onClick={() => fileRef.current?.click()} />
        </div>

        {/* ── Projects ── */}
        <div style={{ marginTop: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: C.text3 }}>
              Your Projects {list.length > 0 && <span style={{ color: C.text3 }}>· {list.length}</span>}
            </p>
            <span style={{ flex: 1 }} />
            {cloudConnected ? (
              <>
                <span title={`Saved to IOsense insight ${insightId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: C.text3 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: cloudBusy ? C.warn : C.good }} />
                  {cloudBusy ? 'Syncing…' : (lastSync ? 'Cloud synced' : 'Cloud')}
                </span>
                <button onClick={refresh} disabled={cloudBusy} title="Refresh projects from IOsense"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 12px', borderRadius: R.pill,
                    border: `1px solid ${C.line}`, background: C.surface, color: C.text2, cursor: cloudBusy ? 'default' : 'pointer',
                    fontFamily: FONT, fontSize: 12, fontWeight: 600, opacity: cloudBusy ? 0.6 : 1 }}>
                  ↻ Refresh
                </button>
              </>
            ) : (
              <button onClick={() => setSettings(true)} title="Connect IOsense to save projects to the cloud"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 12px', borderRadius: R.pill,
                  border: `1px solid ${C.line}`, background: 'transparent', color: C.text3, cursor: 'pointer',
                  fontFamily: FONT, fontSize: 12, fontWeight: 600 }}>
                ○ Connect cloud
              </button>
            )}
          </div>

          {list.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              style={{ padding: '48px 24px', textAlign: 'center', border: `1px dashed ${C.lineStrong}`, borderRadius: R.lg, background: C.surface }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: C.text }}>No projects yet</p>
              <p style={{ fontSize: 13.5, color: C.text2, marginTop: 6 }}>Create one from scratch, choose a template, or upload a JSON layout to begin.</p>
            </motion.div>
          ) : (
            <>
              {/* search + cloud/local filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 360 }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.text3, fontSize: 14, pointerEvents: 'none' }}>⌕</span>
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects…"
                    style={{ width: '100%', height: 36, padding: '0 12px 0 32px', borderRadius: R.pill, border: `1px solid ${C.line}`,
                      background: C.surface, color: C.text, fontFamily: FONT, fontSize: 13, outline: 'none' }} />
                </div>
                <button onClick={() => setMineOnly(v => !v)}
                  title={mineOnly ? 'Showing your projects — click to show all' : (iosenseJWT ? `${iosenseName || iosenseEmail}${iosenseEmail ? ` · ${iosenseEmail}` : ''} — show only my projects` : 'Your local projects')}
                  style={{ flexShrink: 0, width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 700, letterSpacing: 0.3,
                    display: 'grid', placeItems: 'center', border: `1px solid ${mineOnly ? C.accent : C.line}`,
                    background: mineOnly ? C.accent : C.surface, color: mineOnly ? '#fff' : C.text2, boxShadow: SHADOW.card }}>
                  {initials}
                </button>
                <span style={{ flex: 1 }} />
                <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: R.pill, background: C.surface, border: `1px solid ${C.line}` }}>
                  {[['all', 'All'], ['cloud', '☁ Cloud'], ['local', '○ Local']].map(([k, label]) => (
                    <button key={k} onClick={() => setFilter(k)}
                      style={{ padding: '5px 12px', borderRadius: R.pill, border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 600,
                        background: filter === k ? C.accent : 'transparent', color: filter === k ? '#fff' : C.text2 }}>{label}</button>
                  ))}
                </div>
              </div>

              {filtered.length === 0 ? (
                <p style={{ fontSize: 13.5, color: C.text2, padding: '24px 4px' }}>
                  No projects {filter !== 'all' ? `on ${filter === 'cloud' ? 'the cloud' : 'this device'} ` : ''}match{q ? ` “${query.trim()}”` : ''}.
                </p>
              ) : (
                <motion.div variants={{ show: { transition: { staggerChildren: 0.05 } } }} initial="hidden" animate="show"
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18 }}>
                  {filtered.map(p => (
                    <ProjectCard key={p.id} project={p}
                      onOpen={openProject}
                      onRename={(name) => renameProject(p.id, name)}
                      onDuplicate={duplicateProject}
                      onDelete={async (id) => { if (await confirmDialog({ title: 'Delete project?', body: `Delete "${p.name}"? This can't be undone.`, confirmLabel: 'Delete', danger: true })) deleteProject(id) }} />
                  ))}
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {picker && (
          <TemplatePicker onClose={() => setPicker(false)} onPick={(id) => { setPicker(false); createFromTemplate(id) }} />
        )}
      </AnimatePresence>

      {/* toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 80,
              ...glass, border: `1px solid ${toast.type === 'err' ? 'rgba(255,59,48,0.4)' : C.line}`, borderRadius: R.pill,
              boxShadow: SHADOW.panel, padding: '10px 18px', fontSize: 13, color: toast.type === 'err' ? C.bad : C.text, maxWidth: '80vw' }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
