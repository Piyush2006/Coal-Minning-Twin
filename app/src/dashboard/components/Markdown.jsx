// Tiny, dependency-free markdown renderer for Bruce's replies. Renders to real
// React nodes (no dangerouslySetInnerHTML) and covers what the agent emits:
// **bold**, *italic* / _italic_, `code`, [links](url), unordered (- / *) and
// ordered (1.) lists, #-headings, and paragraphs.
import { Fragment } from 'react'

const codeStyle = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.88em', padding: '1px 5px', borderRadius: 5, background: 'var(--background-surface-subtle)', border: '1px solid var(--border-gray-subtle)' }

// inline: **bold** · `code` · [text](url) · *italic* / _italic_
// NB: create a FRESH regex per call — inline() recurses into bold content, and a
// shared global regex's lastIndex would be clobbered by the recursion (infinite loop).
const INLINE_SRC = '\\*\\*(.+?)\\*\\*|`([^`]+)`|\\[([^\\]]+)\\]\\(([^)\\s]+)\\)|\\*(.+?)\\*|_(.+?)_'
function inline(text, kp = '') {
  const re = new RegExp(INLINE_SRC, 'g')
  const out = []
  let last = 0, m, k = 0
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) { re.lastIndex++; continue }   // zero-width guard
    if (m.index > last) out.push(<Fragment key={`${kp}t${k++}`}>{text.slice(last, m.index)}</Fragment>)
    if (m[1] != null) out.push(<strong key={`${kp}b${k++}`}>{inline(m[1], `${kp}b${k}`)}</strong>)
    else if (m[2] != null) out.push(<code key={`${kp}c${k++}`} style={codeStyle}>{m[2]}</code>)
    else if (m[3] != null) out.push(<a key={`${kp}a${k++}`} href={m[4]} target="_blank" rel="noreferrer" style={{ color: 'var(--text-brand-default)' }}>{m[3]}</a>)
    else if (m[5] != null) out.push(<em key={`${kp}i${k++}`}>{m[5]}</em>)
    else if (m[6] != null) out.push(<em key={`${kp}j${k++}`}>{m[6]}</em>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(<Fragment key={`${kp}t${k++}`}>{text.slice(last)}</Fragment>)
  return out
}

const isUL = (l) => /^\s*[-*]\s+/.test(l)
const isOL = (l) => /^\s*\d+\.\s+/.test(l)
const isH = (l) => /^#{1,6}\s+/.test(l)

export function Markdown({ text = '' }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }
    const h = line.match(/^(#{1,6})\s+(.*)/)
    if (h) { blocks.push({ type: 'h', level: h[1].length, text: h[2] }); i++; continue }
    if (isUL(line)) {
      const items = []
      while (i < lines.length && isUL(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++ }
      blocks.push({ type: 'ul', items }); continue
    }
    if (isOL(line)) {
      const items = []
      while (i < lines.length && isOL(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++ }
      blocks.push({ type: 'ol', items }); continue
    }
    const para = []
    while (i < lines.length && lines[i].trim() && !isUL(lines[i]) && !isOL(lines[i]) && !isH(lines[i])) { para.push(lines[i]); i++ }
    blocks.push({ type: 'p', text: para.join(' ') })
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {blocks.map((b, idx) => {
        if (b.type === 'h') {
          const size = b.level <= 1 ? 15 : b.level === 2 ? 14 : 13
          return <div key={idx} className="BodyMediumSemibold" style={{ fontSize: size, fontWeight: 700 }}>{inline(b.text, `h${idx}`)}</div>
        }
        if (b.type === 'ul') return (
          <ul key={idx} style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
            {b.items.map((it, j) => <li key={j} style={{ lineHeight: 1.5 }}>{inline(it, `u${idx}_${j}`)}</li>)}
          </ul>
        )
        if (b.type === 'ol') return (
          <ol key={idx} style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 4 }}>
            {b.items.map((it, j) => <li key={j} style={{ lineHeight: 1.5 }}>{inline(it, `o${idx}_${j}`)}</li>)}
          </ol>
        )
        return <div key={idx} style={{ lineHeight: 1.5 }}>{inline(b.text, `p${idx}`)}</div>
      })}
    </div>
  )
}
