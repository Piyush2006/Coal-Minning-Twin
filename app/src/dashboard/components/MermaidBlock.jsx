// Renders a ```mermaid fenced block as an SVG diagram. Mermaid is heavy, so it
// is lazy-loaded on first use (kept out of the main bundle) and initialised once.
import { useEffect, useRef, useState } from 'react'

let mermaidPromise
const loadMermaid = () => (mermaidPromise ||= import('mermaid').then((m) => {
  const mm = m.default
  mm.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict', fontFamily: 'inherit' })
  return mm
}))

let seq = 0

export function MermaidBlock({ code }) {
  const [svg, setSvg] = useState('')
  const [failed, setFailed] = useState(false)
  const idRef = useRef(`mmd-${++seq}`)

  useEffect(() => {
    let alive = true
    setFailed(false); setSvg('')
    loadMermaid()
      .then(mm => mm.render(idRef.current, code.trim()))
      .then(({ svg }) => { if (alive) setSvg(svg) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [code])

  if (failed) {
    return <pre style={{ margin: '6px 0', padding: 10, borderRadius: 8, background: 'var(--background-surface-subtle)', overflowX: 'auto', fontSize: 12 }}>{code}</pre>
  }
  if (!svg) return <div className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', padding: '6px 0' }}>◆ rendering diagram…</div>
  return <div style={{ margin: '6px 0', overflowX: 'auto' }} dangerouslySetInnerHTML={{ __html: svg }} />
}
