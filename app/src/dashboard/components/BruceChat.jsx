// Bruce — floating AI assistant, bottom-right of the dashboard. Every question
// is sent to the Bruce agent together with a fresh LIVE DATA CONTEXT (see
// lib/bruceContext) built from the same calc the dashboard renders, so Bruce
// answers about exactly what the user is viewing (current filters + range).
import { useRef, useState, useEffect } from 'react'
import { useDash } from '../store'
import { bruceChat } from '../lib/bruceClient'
import { buildBruceContext } from '../lib/bruceContext'
import { RichMessage } from './RichMessage'

const GRADIENT = 'linear-gradient(135deg, #a779f0 0%, #5b5bf0 100%)'
const LOGO = '/bruce-logo.svg'
const GREETING = "Hi, I'm Bruce 👋 — I can see this dashboard's live data. Ask me about production, cost, downtime, fleet health or safety for the selected range."
const SUGGESTIONS = [
  'Why did we miss the production plan?',
  'Which units need maintenance most urgently?',
  'Summarise the safety issues in this period.',
  'Where is our operating cost highest?',
]

const Avatar = ({ size = 26 }) => (
  <img src={LOGO} alt="Bruce" width={size} height={size} style={{ borderRadius: size * 0.28, display: 'block', flexShrink: 0 }} />
)

export function BruceChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([{ role: 'bot', text: GREETING }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const sessionRef = useRef(null)
  const scrollRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [messages, open])
  useEffect(() => () => abortRef.current?.abort(), [])

  // Questions routed from anywhere on the dashboard ("Ask Bruce →") open the
  // panel and auto-send. bruceSeed.n increments each call so repeats re-fire.
  const seed = useDash(s => s.bruceSeed)
  const seenSeed = useRef(0)
  useEffect(() => {
    if (seed && seed.n !== seenSeed.current) {
      seenSeed.current = seed.n
      setOpen(true)
      ask(seed.q)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed])

  const ask = async (question) => {
    const q = question.trim()
    if (!q || busy) return
    setInput('')
    setBusy(true)
    setMessages(m => [...m, { role: 'user', text: q }, { role: 'bot', text: '' }])
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const context = buildBruceContext(useDash.getState())
      const message = `${context}\n\n---\nUSER QUESTION: ${q}`
      const { sessionId } = await bruceChat({
        message,
        sessionId: sessionRef.current,
        signal: ctrl.signal,
        onText: (fullText) => setMessages(m => {
          const copy = m.slice()
          copy[copy.length - 1] = { role: 'bot', text: fullText }
          return copy
        }),
      })
      sessionRef.current = sessionId || sessionRef.current
    } catch (e) {
      if (e.name !== 'AbortError') setMessages(m => {
        const copy = m.slice()
        copy[copy.length - 1] = { role: 'bot', text: `⚠️ ${e.message}` }
        return copy
      })
    } finally { setBusy(false); abortRef.current = null }
  }

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input) } }

  const reset = () => {
    abortRef.current?.abort()
    sessionRef.current = null          // start a fresh platform session next turn
    setBusy(false)
    setInput('')
    setMessages([{ role: 'bot', text: GREETING }])
  }

  // ── Collapsed floating button — icon only ──
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} aria-label="Ask Bruce" title="Ask Bruce"
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.04)'; e.currentTarget.style.boxShadow = '0 14px 36px rgba(60,50,120,0.36)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(60,50,120,0.30)' }}
        style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9998, width: 50, height: 50, borderRadius: 16, border: 'none',
          background: GRADIENT, display: 'grid', placeItems: 'center', cursor: 'pointer',
          boxShadow: '0 10px 28px rgba(60,50,120,0.30)', transition: 'transform 150ms, box-shadow 150ms' }}>
        <Avatar size={30} />
      </button>
    )
  }

  // ── Expanded chat panel ──
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9998, width: 390, maxWidth: 'calc(100vw - 32px)', height: 580, maxHeight: 'calc(100vh - 48px)',
      display: 'flex', flexDirection: 'column', background: 'var(--background-surface-intense)', borderRadius: 16, overflow: 'hidden',
      boxShadow: '0 20px 60px rgba(40,40,90,0.28)', border: '1px solid var(--border-gray-subtle)' }}>

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px', background: GRADIENT, color: '#fff' }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.16)', display: 'grid', placeItems: 'center' }}><Avatar size={26} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.1 }}>Bruce</div>
          <div style={{ fontSize: 11.5, opacity: 0.85 }}>AI assistant · sees live dashboard data</div>
        </div>
        <button onClick={reset} title="Reset chat" aria-label="Reset chat"
          style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.18)', color: '#fff', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>↺</button>
        <button onClick={() => setOpen(false)} title="Minimise" aria-label="Minimise"
          style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.18)', color: '#fff', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>—</button>
      </div>

      {/* messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--background-surface-moderate)' }}>
        {messages.map((m, i) => <Bubble key={i} role={m.role} text={m.text} busy={busy && i === messages.length - 1 && m.role === 'bot' && !m.text} />)}
        {messages.length === 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => ask(s)} className="BodyXSmallRegular"
                style={{ textAlign: 'left', padding: '7px 11px', borderRadius: 12, border: '1px solid var(--border-gray-default)', background: 'var(--background-surface-intense)', color: 'var(--text-gray-secondary)', cursor: 'pointer' }}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* input */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: 12, borderTop: '1px solid var(--border-gray-subtle)', background: 'var(--background-surface-intense)' }}>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} rows={1} placeholder="Ask about this dashboard…"
          style={{ flex: 1, resize: 'none', maxHeight: 96, padding: '9px 11px', borderRadius: 12, border: '1px solid var(--border-gray-default)', background: 'var(--background-surface-moderate)', font: 'inherit', fontSize: 14, color: 'var(--text-gray-primary)' }} />
        <button onClick={() => ask(input)} disabled={!input.trim() || busy} aria-label="Send"
          style={{ width: 40, height: 40, borderRadius: 12, border: 'none', background: (!input.trim() || busy) ? 'var(--border-gray-default)' : GRADIENT, color: '#fff', cursor: (!input.trim() || busy) ? 'default' : 'pointer', fontSize: 17, flexShrink: 0 }}>➤</button>
      </div>
    </div>
  )
}

function Bubble({ role, text, busy }) {
  const isUser = role === 'user'
  return (
    <div style={{ display: 'flex', gap: 8, flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
      {!isUser && <Avatar size={24} />}
      <div className="BodySmallRegular" style={{ maxWidth: isUser ? '82%' : '94%', flex: isUser ? '0 1 auto' : '1 1 auto', minWidth: 0, padding: '9px 12px', borderRadius: 13, wordBreak: 'break-word', lineHeight: 1.45,
        background: isUser ? 'var(--background-brand-default)' : 'var(--background-surface-intense)',
        color: isUser ? '#fff' : 'var(--text-gray-primary)',
        border: isUser ? 'none' : '1px solid var(--border-gray-subtle)',
        borderTopRightRadius: isUser ? 4 : 13, borderTopLeftRadius: isUser ? 13 : 4 }}>
        {busy ? <span style={{ color: 'var(--text-gray-tertiary)' }}>Bruce is thinking…</span>
          : isUser ? <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>
          : <RichMessage text={text} />}
      </div>
    </div>
  )
}
