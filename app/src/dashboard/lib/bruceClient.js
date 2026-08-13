// Fresh, self-contained Bruce agent client for the management dashboard.
// Talks directly to the IOsense AI Agents platform (CORS-enabled, verified):
//   POST {BASE}/backend/api/agents/v1/agents/{AGENT_ID}/chat
//   headers: content-type: application/json, X-API-Key: <agent key>
//   body:    { message, session_id? }
//   reply:   Server-Sent Events. Reply text streams as `block_delta` events; a
//            `session` event carries the platform session id (server-side history).
//
// NOTE: the agent key is agent-scoped (`agv2_…`) and, like any browser-side
// integration, ships in the client bundle. It only identifies which agent to
// talk to. Rotate it on the platform if it should not be public.
export const BRUCE = {
  base: 'https://bruce-staging.iosense.io',
  agentId: '6a758fb14c3f1af190ed090e',
  apiKey: 'agv2_pI5oj7MzZUkv_NCeGLaiPzSembdWRLjT4jB9wvs6BBE',
}
const CHAT_URL = `${BRUCE.base}/backend/api/agents/v1/agents/${BRUCE.agentId}/chat`

// Dig a text payload out of an event/reply object (shapes vary by platform build).
function pickText(o, depth = 0) {
  if (typeof o === 'string') return o
  if (!o || typeof o !== 'object' || depth > 3) return ''
  for (const k of ['delta', 'text', 'content', 'response', 'final_response', 'answer', 'output', 'reply', 'message']) {
    if (typeof o[k] === 'string' && o[k]) return o[k]
  }
  for (const k of ['data', 'payload', 'message', 'response', 'result', 'output']) {
    if (o[k] && typeof o[k] === 'object') { const t = pickText(o[k], depth + 1); if (t) return t }
  }
  return ''
}

// One chat turn. Streams the answer-so-far through onText(fullText) — it REPLACES
// (not appends), so it is robust whether the platform emits deltas or cumulative
// content. Resolves to { text, sessionId }; pass the previous sessionId to keep
// the conversation going. Throws on a `type:"error"` event (e.g. the agent's
// model provider rejecting the request) so the UI can show why.
//
// Observed event stream (live):
//   data: {"type":"session","sessionId":"…"}
//   data: {"type":"user_message", …}
//   data: {"type":"stream_start","role":"assistant","content":"","isPartial":true, …}
//   data: {"type":"stream_delta"|"stream_token","content":"…chunk…"}   (deltas)  OR
//   data: {"type":"message","role":"assistant","content":"…full…","isPartial":false}
//   data: {"type":"error","content":"…why…","status":"failed"}
//   data: {"type":"done"}
export async function bruceChat({ message, sessionId, onText, signal }) {
  const res = await fetch(CHAT_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-API-Key': BRUCE.apiKey },
    body: JSON.stringify({ message, ...(sessionId ? { session_id: sessionId } : {}) }),
    signal,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Bruce ${res.status} — ${detail || res.statusText}`)
  }

  // Non-streaming JSON fallback.
  const ctype = res.headers.get('content-type') || ''
  if (!ctype.includes('event-stream') || !res.body) {
    const j = await res.json().catch(() => null)
    const text = pickText(j) || (typeof j === 'string' ? j : '')
    if (text) onText?.(text)
    return { text, sessionId: j?.session_id || j?.sessionId || sessionId || null }
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = '', full = '', appended = '', sid = sessionId || null
  const best = () => full || appended
  const emit = () => { const t = best(); if (t) onText?.(t) }

  const consume = (block) => {
    const dataStr = block.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('\n')
    const raw = (dataStr || block).trim()
    if (!raw || raw === '[DONE]') return
    let e
    try { e = JSON.parse(raw) } catch { appended += raw; emit(); return }   // plain-text data line
    sid = e.sessionId || e.session_id || e.data?.sessionId || e.data?.session_id || sid
    const type = String(e.type || e.event || '')
    if (/error/i.test(type) || e.status === 'failed') {
      throw new Error(pickText(e) || e.content || e.detail || 'Bruce returned an error event.')
    }
    if (type === 'session' || type === 'user_message' || type === 'done' || type === 'ping') return
    // any assistant text carrier: content (cumulative/final) or delta (chunk)
    const content = typeof e.content === 'string' ? e.content : (typeof e.delta === 'string' ? e.delta : pickText(e))
    if (!content) return
    if (/delta|token|chunk/i.test(type)) appended += content   // incremental chunk
    else full = content                                        // cumulative / final replaces
    emit()
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const parts = buf.split(/\r?\n\r?\n/)   // SSE events separated by a blank line
    buf = parts.pop()
    for (const p of parts) consume(p)
  }
  if (buf.trim()) consume(buf)

  const text = best()
  if (!text) throw new Error('Bruce sent an empty reply.')
  return { text, sessionId: sid }
}
