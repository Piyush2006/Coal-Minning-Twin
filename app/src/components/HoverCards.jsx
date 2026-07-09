import { C, FONT, STATUS_COLOR } from '../ui/theme'

// ── The app's standard hover cards (extracted from SceneRenderer so bespoke
// assets — e.g. the boiler's internal-zone hovers — reuse the exact same look). ──
export const fmtNum = (v) => { const n = +v; return Number.isFinite(n) ? (Math.round(n * 100) / 100).toLocaleString() : String(v ?? '') }
export const CARD = { background: '#fff', borderRadius: 14, border: `1px solid ${C.line}`,
  boxShadow: '0 10px 30px rgba(20,28,50,0.18)', fontFamily: FONT, userSelect: 'none', overflow: 'hidden' }

export function ComponentCard({ name, status, rows }) {
  return (
    <div style={{ ...CARD, width: 190 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px 8px' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[status] || C.text3, flexShrink: 0 }} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
      </div>
      <div style={{ height: 1, background: C.line }} />
      <div style={{ padding: '7px 12px 9px' }}>
        {rows.map(r => (
          <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '2.5px 0', fontSize: 11.5 }}>
            <span style={{ color: C.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</span>
            <span style={{ color: C.text, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {fmtNum(r.value)}{r.unit ? <span style={{ color: C.text3, fontWeight: 500 }}> {r.unit}</span> : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function GroupCard({ name, total, running, idle, fault }) {
  const avail = total ? Math.round((running / total) * 100) : 0
  const ac = avail >= 80 ? C.good : avail >= 50 ? C.warn : C.bad
  const cells = [['Running', running, C.good], ['Idle', idle, C.warn], ['Fault', fault, C.bad]]
  return (
    <div style={{ ...CARD, width: 230 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 13px 9px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: ac, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, color: ac, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{avail}<span style={{ fontSize: 11 }}>%</span></span>
      </div>
      <div style={{ height: 1, background: C.line }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, padding: '9px 13px 11px' }}>
        {cells.map(([l, v, c]) => (
          <div key={l}>
            <div style={{ fontSize: 15, fontWeight: 700, color: v ? c : C.text3, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{v}</div>
            <div style={{ fontSize: 9.5, color: C.text3, marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.3 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
