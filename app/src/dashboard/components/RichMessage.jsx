// Renders a Bruce reply: plain prose as markdown, ```chart blocks as real charts,
// ```mermaid blocks as diagrams, other fenced blocks as code. Tolerant of the
// partial text seen mid-stream (an unclosed fence shows a "preparing…" note
// until it completes).
import { Markdown } from './Markdown'
import { ChartBlock } from './ChartBlock'
import { MermaidBlock } from './MermaidBlock'

const FENCE = /```([a-zA-Z0-9_-]+)?[ \t]*\r?\n([\s\S]*?)```/g

// tolerant JSON: strip trailing commas before } or ]
function parseSpec(raw) {
  try { return JSON.parse(raw) } catch { /* try a light cleanup */ }
  try { return JSON.parse(raw.replace(/,\s*([}\]])/g, '$1')) } catch { return null }
}

const Pending = ({ label }) => (
  <div className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', padding: '6px 0' }}>{label}</div>
)

// render a prose segment; if it contains an unclosed fence (streaming), show the
// text before it + a pending note instead of leaking raw ``` markup.
function Prose({ text, keyBase }) {
  const open = text.indexOf('```')
  if (open === -1) return <Markdown text={text} />
  const before = text.slice(0, open)
  const langMatch = text.slice(open + 3).match(/^([a-zA-Z0-9_-]+)/)
  const lang = (langMatch?.[1] || '').toLowerCase()
  const label = lang === 'chart' ? '◱ preparing chart…' : lang === 'mermaid' ? '◆ preparing diagram…' : '…'
  return <>{before.trim() && <Markdown text={before} />}<Pending label={label} /></>
}

export function RichMessage({ text = '' }) {
  const parts = []
  let last = 0, m
  FENCE.lastIndex = 0
  while ((m = FENCE.exec(text)) !== null) {
    if (m.index > last) parts.push({ t: 'prose', v: text.slice(last, m.index) })
    parts.push({ t: 'fence', lang: (m[1] || '').toLowerCase(), v: m[2] })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ t: 'prose', v: text.slice(last) })
  if (!parts.length) parts.push({ t: 'prose', v: text })

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {parts.map((p, i) => {
        if (p.t === 'prose') return <Prose key={i} text={p.v} keyBase={i} />
        if (p.lang === 'chart') {
          const spec = parseSpec(p.v)
          return spec ? <ChartBlock key={i} spec={spec} /> : <pre key={i} style={preStyle}>{p.v}</pre>
        }
        if (p.lang === 'mermaid') return <MermaidBlock key={i} code={p.v} />
        return <pre key={i} style={preStyle}>{p.v}</pre>
      })}
    </div>
  )
}

const preStyle = { margin: '4px 0', padding: 10, borderRadius: 8, background: 'var(--background-surface-subtle)', border: '1px solid var(--border-gray-subtle)', overflowX: 'auto', fontSize: 12, lineHeight: 1.5 }
