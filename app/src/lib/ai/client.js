// Bruce client — talks to the REAL Bruce agent on the IOsense AI Agents platform
// (replaces the old bring-your-own-key Anthropic/OpenAI/Gemini client).
//
//   POST {endpoint}/backend/api/agents/v1/agents/{agentId}/chat
//   headers: X-API-Key (an agent-scoped `agv2_…` key — identifies WHICH agent)
//   body:    { message, session_id? }
//   reply:   SSE stream of JSON events (same event format as the platform's
//            WebSocket chat) — we accumulate deltas and/or take the final
//            full-response event, and capture session_id when it appears.
//
// The agent itself carries the system prompt + skill files (authored from
// skills/BRUCE_AGENT_PROMPT.md); the app sends ONLY the per-request context
// blocks + the user's message (see buildBruceMessage in prompt.js). Session
// state (conversation history) lives on the platform, keyed per project.

export const DEFAULT_BRUCE_URL = 'https://bruce-staging.iosense.io'

// The platform allows cross-origin browser calls (ACAO * + x-api-key in the
// preflight — verified live), so we call it DIRECTLY. No dev proxy: a proxy
// path would 404 on a production build where the Vite dev server isn't running.
function resolveRoot(endpoint) {
  return (endpoint || DEFAULT_BRUCE_URL).replace(/\/$/, '')
}

// Observed event stream (confirmed live against the platform):
//   data: {"type":"session","sessionId":"…"}
//   data: {"type":"block","data":{"kind":"tool-call","status":"running|done","detail":{…}}}
//   data: {"type":"block_delta","id":"b1","kind":"text","delta":"…chunk…"}
//   data: {"type":"sources","data":[{kind:"skill",text:"…citation…"},…]}
//   data: {"type":"done"}
const DELTA_TYPE = /chunk|delta|token|stream/i
const FULL_TYPE = /final|complete|response|answer/i
const ERROR_TYPE = /error|fail/i
const IGNORE_TYPE = /^(session|sources|done|ping|block)$/i   // block = tool/progress, not reply text

// Pull the most plausible text payload out of one event object. Payloads vary
// by platform version, so this digs through common wrappers a couple of levels
// deep ({data:{content}}, {message:{content}}, {choices:[{delta:{content}}]}, …).
const TEXT_KEYS = ['delta', 'chunk', 'token', 'text_delta', 'content', 'text', 'response', 'final_response', 'output', 'answer', 'message', 'reply', 'result']
const WRAP_KEYS = ['data', 'payload', 'event', 'message', 'delta', 'response', 'result', 'output']
function evtText(e, depth = 0) {
  if (typeof e === 'string') return e
  if (!e || typeof e !== 'object' || depth > 3) return ''
  if (Array.isArray(e)) { for (const it of e) { const t = evtText(it, depth + 1); if (t) return t } return '' }
  for (const k of TEXT_KEYS) {
    const v = e[k]
    if (typeof v === 'string' && v) return v
  }
  if (Array.isArray(e.choices)) { const t = evtText(e.choices, depth + 1); if (t) return t }
  for (const k of WRAP_KEYS) {
    const v = e[k]
    if (v && typeof v === 'object') { const t = evtText(v, depth + 1); if (t) return t }
  }
  return ''
}

// Classify one SSE event → { kind: 'delta'|'full'|'error'|'meta', text }
function classify(e) {
  const t = String(e?.type || e?.event || '')
  if (ERROR_TYPE.test(t) || e?.error) {
    const msg = (typeof e.error === 'string' && e.error) || e?.detail || e?.message || evtText(e) || 'Bruce returned an error event.'
    return { kind: 'error', text: String(msg) }
  }
  // A completed full-text block (non-streamed reply) is the one 'block' we keep.
  if (t === 'block' && e?.data?.kind === 'text') return { kind: 'full', text: evtText(e.data) }
  if (IGNORE_TYPE.test(t)) return { kind: 'meta', text: '' }
  if (t && DELTA_TYPE.test(t)) return { kind: 'delta', text: evtText(e) }
  if (t && FULL_TYPE.test(t)) return { kind: 'full', text: evtText(e) }
  // no recognisable type — infer from payload shape
  if (typeof e?.delta === 'string' || typeof e?.chunk === 'string' || typeof e?.token === 'string') return { kind: 'delta', text: evtText(e) }
  const full = evtText(e)
  return full ? { kind: 'full', text: full } : { kind: 'meta', text: '' }
}

// Read the body ONCE (json() then text() on the same Response throws
// "body stream already read" and masks the real error).
async function errText(res) {
  const t = await res.text().catch(() => '')
  try { const j = JSON.parse(t); return j.detail || j.message || j.error || t } catch { return t || res.statusText }
}

// Detailed component specs legitimately stream for minutes — but a stalled
// connection must never hang the build pipeline forever. Hard cap per turn
// (covers the fetch AND the SSE stream); a timeout surfaces visibly and the
// pipeline's placeholder fallback keeps the build moving.
const CALL_TIMEOUT_MS = 360_000

// One chat turn with the Bruce agent → { text, sessionId }.
// sessionId null/undefined starts a fresh platform session (the reply carries
// the new id when the platform emits one).
export async function chat(args) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), CALL_TIMEOUT_MS)
  try { return await chatTurn(args, ctrl.signal) }
  catch (e) {
    if (e.name === 'AbortError') throw new Error(`Bruce call timed out after ${CALL_TIMEOUT_MS / 60000} min — the agent may be stuck on the platform; try again.`)
    throw e
  } finally { clearTimeout(timer) }
}

async function chatTurn({ endpoint, agentId, apiKey, message, sessionId }, signal) {
  if (!apiKey) throw new Error('No Bruce API key set. Open Settings (⚙) → Bruce.')
  if (!agentId) throw new Error('No Bruce agent ID set. Open Settings (⚙) → Bruce.')
  const url = `${resolveRoot(endpoint)}/backend/api/agents/v1/agents/${encodeURIComponent(agentId)}/chat`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ message, ...(sessionId ? { session_id: sessionId } : {}) }),
    signal,
  })
  if (!res.ok) throw new Error(`Bruce ${res.status} — ${await errText(res)}`)

  const ctype = res.headers.get('content-type') || ''
  if (!ctype.includes('event-stream')) {
    // Non-streaming JSON reply — take the obvious text field.
    const j = await res.json().catch(() => null)
    if (j == null) throw new Error('Bruce returned an unreadable reply.')
    const { kind, text } = classify(j)
    if (kind === 'error') throw new Error(text)
    return { text: text || JSON.stringify(j), sessionId: j.session_id || j.sessionId || sessionId || null }
  }

  // ── SSE: accumulate deltas; keep the last full-response event; watch for ids ──
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let deltas = ''
  let lastFull = ''
  let sid = sessionId || null
  const handleEvent = (payload) => {
    const raw = payload.trim()
    if (!raw || raw === '[DONE]') return
    let e
    try { e = JSON.parse(raw) } catch { deltas += raw; return }   // plain-text data line
    console.debug('[Bruce] event:', e)   // leave on: the format varies per platform build
    sid = e?.session_id || e?.sessionId || e?.data?.session_id || e?.data?.sessionId || sid
    const { kind, text } = classify(e)
    if (kind === 'error') throw new Error(text || 'Bruce returned an error event.')
    if (kind === 'delta') deltas += text
    else if (kind === 'full' && text) lastFull = text
  }
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    // SSE events are separated by a blank line; each may carry several data: lines.
    const events = buf.split(/\r?\n\r?\n/)
    buf = events.pop()   // keep the trailing partial event
    for (const evt of events) {
      const data = evt.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('\n')
      handleEvent(data || evt)
    }
  }
  if (buf.trim()) {
    const data = buf.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('\n')
    handleEvent(data || buf)
  }

  // The reply streams as block_delta text on this platform — deltas win; a
  // completed full-text block is the fallback for non-streamed replies.
  const text = deltas || lastFull
  if (!text) throw new Error('Bruce sent an empty reply (the agent finished without producing text — check the agent’s model/maxTokens on the platform).')
  return { text, sessionId: sid }
}
