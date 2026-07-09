import { useEffect, useMemo, useState } from 'react'
import { useSceneStore } from '../store/sceneStore'
import { useAIStore } from '../store/aiStore'
import { resolveAndCompute } from '../lib/unsResolve'
import { C, R, glass, SHADOW } from '../ui/theme'

// ─────────────────────────────────────────────────────────────────────────────
// TEMPORARY UNS debug window (bottom-right). Lists every parameter bound to a UNS
// topic and shows its OFFICIAL resolveAndCompute result — the live value, or the
// resolver's own error ("no match" / "no value returned for key"). Self-contained:
// to remove, delete this file and its <UnsDebugPanel/> mount in Root.jsx.
// ─────────────────────────────────────────────────────────────────────────────

const POLL_MS = 6000

export function UnsDebugPanel() {
  const objects = useSceneStore(s => s.objects)
  const token = useAIStore(s => s.iosenseJWT || s.unsBrowseToken)   // platform session powers UNS

  const [open, setOpen] = useState(true)
  const [res, setRes] = useState({})      // "objId::key" → { value, error }
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')

  const bound = useMemo(() => {
    const out = []
    for (const o of Object.values(objects || {})) {
      const meta = o.paramMeta || {}
      for (const k in meta) {
        const t = meta[k]?.topic
        if (t) out.push({ objId: o.id, objName: o.name || o.type, key: k, label: meta[k]?.label || k, topic: t })
      }
    }
    return out
  }, [objects])

  const topicsSig = bound.map(b => b.topic).join('|')

  useEffect(() => {
    if (!token || bound.length === 0) return
    let live = true
    const tick = async () => {
      const items = bound.filter(b => b.topic.startsWith('uns:')).map(b => ({ key: `${b.objId}::${b.key}`, topic: b.topic }))
      if (!items.length) { setRes({}); return }
      try {
        const now = Date.now()
        const r = await resolveAndCompute({ token }, items, { startTime: now - 30 * 86_400_000, endTime: now })
        if (live) { setRes(r); setErr(''); setNote(new Date().toLocaleTimeString()) }
      } catch (e) { if (live) setErr(e.message || 'poll failed') }
    }
    tick()
    const id = setInterval(tick, POLL_MS)
    return () => { live = false; clearInterval(id) }
  }, [token, topicsSig])   // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} title="Open UNS debug"
        style={{ position: 'fixed', right: 14, bottom: 14, zIndex: 200, ...glass, border: `1px solid ${C.line}`,
          borderRadius: R.pill, boxShadow: SHADOW.card, padding: '7px 12px', cursor: 'pointer', color: C.text2,
          fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: token ? '#34c759' : C.text3 }} />
        UNS debug · {bound.length}
      </button>
    )
  }

  const cell = (b) => {
    if (!b.topic.startsWith('uns:')) return <span style={{ color: C.text3 }}>not uns:// — re-pick</span>
    const r = res[`${b.objId}::${b.key}`]
    if (!r) return <span style={{ color: C.text3 }}>…</span>
    if (r.error) return <span style={{ color: C.warn || '#ffaa00' }} title={r.error}>{r.error}</span>
    return <span style={{ color: '#34c759', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{String(r.value)}</span>
  }

  return (
    <div style={{ position: 'fixed', right: 14, bottom: 14, zIndex: 200, width: 360, maxHeight: '46vh',
      display: 'flex', flexDirection: 'column', ...glass, border: `1px solid ${C.line}`, borderRadius: R.md, boxShadow: SHADOW.panel, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderBottom: `1px solid ${C.line}` }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: token ? '#34c759' : C.text3, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>UNS Debug · resolveAndCompute</span>
        <span style={{ fontSize: 10.5, color: C.text3 }}>{bound.length}{note ? ` · ${note}` : ''}</span>
        <span style={{ flex: 1 }} />
        <button onClick={() => setOpen(false)} title="Minimise"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, fontSize: 16, lineHeight: 1, padding: 0 }}>–</button>
      </div>

      <div style={{ overflowY: 'auto', padding: '4px 0' }}>
        {!token && <div style={{ padding: 12, fontSize: 12, color: C.text3, lineHeight: 1.5 }}>No UNS session — connect IOsense in Settings.</div>}
        {token && bound.length === 0 && <div style={{ padding: 12, fontSize: 12, color: C.text3, lineHeight: 1.5 }}>No bound tags. Edit a parameter → type <b>/</b> in its UNS field.</div>}
        {token && bound.map(b => (
          <div key={`${b.objId}:${b.key}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: `1px solid ${C.line}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ color: C.text3 }}>{b.objName} · </span>{b.label}
              </div>
              <div title={b.topic} style={{ fontSize: 10, color: C.text3, fontFamily: 'ui-monospace, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.topic}</div>
            </div>
            <div style={{ fontSize: 11.5, flexShrink: 0, textAlign: 'right', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{cell(b)}</div>
          </div>
        ))}
      </div>

      {err && <div style={{ padding: '7px 12px', fontSize: 10.5, color: C.bad, borderTop: `1px solid ${C.line}` }}>{err}</div>}
    </div>
  )
}
