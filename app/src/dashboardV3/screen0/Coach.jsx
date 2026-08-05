// First-run coach marks — Pulse only, three steps, once ever. A dimmed backdrop
// with a spotlight cut over each anchor (data-coach="headline|waterfall|scrubber")
// and a small tooltip. Dismissible; sets localStorage dv3.coachDone and never
// returns. Three steps, not seven — just enough to teach the loop.
import { useEffect, useLayoutEffect, useState } from 'react'

const STEPS = [
  { anchor: 'headline', title: 'Are we making the number?', body: 'Saleable coal against plan, right now — the one question this screen answers.' },
  { anchor: 'waterfall', title: 'Where the tonnes went', body: 'Every tonne of the gap, attributed to a cause. Click a step to open its diagnosis.' },
  { anchor: 'scrubber', title: 'Replay the shift', body: 'Drag to 16:52 and watch the mine change — the whole screen moves to that moment.' },
]
const KEY = 'dv3.coachDone'

export function Coach() {
  const [done, setDone] = useState(() => { try { return localStorage.getItem(KEY) === '1' } catch { return true } })
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState(null)

  const measure = () => {
    const el = document.querySelector(`[data-coach="${STEPS[step].anchor}"]`)
    setRect(el ? el.getBoundingClientRect() : null)
  }
  useLayoutEffect(() => { if (!done) measure() }, [step, done])
  useEffect(() => {
    if (done) return
    const onR = () => measure()
    window.addEventListener('resize', onR); window.addEventListener('scroll', onR, true)
    return () => { window.removeEventListener('resize', onR); window.removeEventListener('scroll', onR, true) }
  }, [step, done])

  if (done) return null
  const finish = () => { try { localStorage.setItem(KEY, '1') } catch {} setDone(true) }
  const s = STEPS[step]
  const pad = 8
  const r = rect ? { x: rect.x - pad, y: rect.y - pad, w: rect.width + pad * 2, h: rect.height + pad * 2 } : null
  // tooltip below the spotlight if room, else above
  const below = r ? r.y + r.h + 150 < window.innerHeight : true
  const tipY = r ? (below ? r.y + r.h + 12 : r.y - 12) : 120
  const tipX = r ? Math.min(Math.max(r.x, 16), window.innerWidth - 320) : 120

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <mask id="coach-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="#fff" />
            {r && <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="10" fill="#000" />}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(13,17,23,0.55)" mask="url(#coach-mask)" />
        {r && <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="10" fill="none" stroke="var(--accent)" strokeWidth="2" />}
      </svg>
      <div style={{ position: 'absolute', left: tipX, top: below ? tipY : undefined, bottom: below ? undefined : window.innerHeight - tipY, width: 300,
        background: 'var(--surface)', borderRadius: 12, boxShadow: '0 12px 40px rgba(16,24,40,0.28)', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
          <span className="dv3-mono dv3-tert" style={{ fontSize: 11 }}>{step + 1} / {STEPS.length}</span>
          <div style={{ fontWeight: 650, fontSize: 14 }}>{s.title}</div>
        </div>
        <div className="dv3-support" style={{ fontSize: 12.5, lineHeight: 1.5, marginBottom: 12 }}>{s.body}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={finish} className="dv3-btn dv3-btn--ghost" style={{ fontSize: 12, padding: '5px 10px' }}>Skip</button>
          <span style={{ flex: 1 }} />
          <button onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : finish())}
            className="dv3-btn" style={{ fontSize: 12.5, padding: '6px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            {step < STEPS.length - 1 ? 'Next' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  )
}
