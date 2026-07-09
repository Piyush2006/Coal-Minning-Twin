// IOsense account integration (browser, bring-your-own-token).
//   SSO flow: ?token=… (one-time, 60s) → validateSSOToken → Bearer JWT + org id.
//   Insights: the account's Bruce collections; Insight RESULTS: the docs we store
//   under one insight (our cloud project store).
//
// Auth convention: every account call takes an `auth` object { jwt, base, org }.
//   - Authorization: <jwt>           (jwt already includes "Bearer ")
//   - organisation: <org>            (org id from the SSO/login response)
//   - Content-Type: application/json
// The organisation header is REQUIRED by the platform on data calls — omitting it
// silently scopes you to nothing (that's why the insights list came back empty).

export const IOSENSE_BASE = 'https://connector.iosense.io/api'

const root = (base) => (base || IOSENSE_BASE).replace(/\/$/, '')
const bearer = (jwt) => (jwt?.startsWith('Bearer ') ? jwt : `Bearer ${jwt}`)

// Standard headers for an authenticated account call.
const headers = ({ jwt, org } = {}) => ({
  Authorization: bearer(jwt),
  'Content-Type': 'application/json',
  ...(org ? { organisation: org } : {}),
})

async function errText(res) {
  try { const j = await res.json(); return j.errors?.[0] || j.message || JSON.stringify(j) } catch { return await res.text() }
}

// Parse a fetch response defensively (server occasionally returns text on error).
async function parseJSON(res) {
  const text = await res.text()
  try { return JSON.parse(text) } catch { return text }
}
const msgOf = (j) => (typeof j === 'string' ? j : (j?.errors?.[0] || j?.message || JSON.stringify(j?.error || j)))

// Exchange a one-time SSO token (from ?token=) for a Bearer JWT + identity.
export async function exchangeSSOToken(ssoToken, base) {
  const res = await fetch(`${root(base)}/retrieve-sso-token/${encodeURIComponent(ssoToken)}`, {
    method: 'GET',
    headers: { organisation: 'https://iosense.io', 'ngsw-bypass': 'true', 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`SSO ${res.status} — ${await errText(res)}`)
  const data = await res.json()
  if (!data?.success || !data?.token) throw new Error(data?.errors?.[0] || 'SSO token invalid or expired — generate a new one.')
  return { token: data.token, organisation: data.organisation, userId: data.userId }
}

// Profile of the currently authenticated user → { name, email, orgName, orgId, userId }.
export async function fetchUserMeta(auth) {
  if (!auth?.jwt) throw new Error('Not connected to IOsense.')
  const res = await fetch(`${root(auth.base)}/account/ai-sdk/metaData/user`, { method: 'GET', headers: headers(auth) })
  if (!res.ok) throw new Error(`Profile ${res.status} — ${await errText(res)}`)
  const d = (await res.json())?.data || {}
  const nm = d.userDetail?.personalDetails?.name || {}
  return {
    name: [nm.first, nm.last].filter(Boolean).join(' ').trim(),
    email: d.email || '',
    orgName: d.organisation?.orgName || '',
    orgId: d.organisation?._id || d.organisation?.orgID || '',
    userId: d._id || '',
  }
}

// Find the array of rows anywhere the API might nest it.
function pickRows(j) {
  const cands = [j?.data?.data, j?.data?.insights, j?.data?.results, j?.data?.docs, j?.data, j?.insights, j?.results, j?.docs, j]
  for (const c of cands) if (Array.isArray(c)) return c
  return []
}

// List the account's insights → { rows, raw }. Scoping is by token + org header
// (there is no per-user body filter); `filters`/`sort` are optional refinements.
export async function fetchInsights(auth, { filters, sort } = {}) {
  if (!auth?.jwt) throw new Error('Not connected to IOsense.')
  const res = await fetch(`${root(auth.base)}/account/bruce/userInsight/fetch/paginated`, {
    method: 'PUT',
    headers: headers(auth),
    body: JSON.stringify({ pagination: { page: 1, count: 200 }, sort: sort || { createdAt: -1 }, ...(filters ? { filters } : {}) }),
  })
  const j = await parseJSON(res)
  if (!res.ok) throw new Error(`Insights ${res.status} — ${msgOf(j)}`)
  const rows = pickRows(j)
  console.debug('[IOsense] insights →', rows.length, 'rows; raw:', j)
  return { rows, raw: j }
}

// ── Bruce: insight RESULT documents (store/fetch arbitrary data under an insight) ──

// Store a result document under an insightID. `doc` = { resultName, result, tags?, userID? }.
// The `result` object is the free-form payload (e.g. a project scene). Returns the created doc.
export async function addInsightResult(auth, { insightID, resultName, result, tags = [], userID }) {
  if (!auth?.jwt) throw new Error('Not connected to IOsense.')
  if (!insightID) throw new Error('No insight selected.')
  const res = await fetch(`${root(auth.base)}/account/bruce/insightResult/add`, {
    method: 'POST',
    headers: headers(auth),
    body: JSON.stringify({
      insightID, resultName, result: result ?? {}, tags,
      applicationType: 'Insight',
      ...(userID ? { metadata: { userID, dataSource: [] } } : {}),
      invocationTime: new Date().toISOString(),
    }),
  })
  const j = await parseJSON(res)
  if (!res.ok || j?.success === false) throw new Error(`add ${res.status} — ${msgOf(j)}`)
  return j?.data ?? j
}

// Fetch result documents stored under an insightID. Returns { rows, raw }.
export async function fetchInsightResults(auth, insightID, { page = 1, count = 200, filters } = {}) {
  if (!auth?.jwt) throw new Error('Not connected to IOsense.')
  if (!insightID) throw new Error('No insight selected.')
  const res = await fetch(`${root(auth.base)}/account/bruce/insightResult/fetch/paginated/${encodeURIComponent(insightID)}`, {
    method: 'PUT',
    headers: headers(auth),
    body: JSON.stringify({ insightID, pagination: { page, count }, ...(filters ? { filters } : {}) }),
  })
  const j = await parseJSON(res)
  if (!res.ok) throw new Error(`fetch ${res.status} — ${msgOf(j)}`)
  return { rows: pickRows(j), raw: j }
}

// Update a single result document. The changed fields go under `updatedFields`
// (confirmed by the server's "updatedFields must be an object" error). We try
// with/without `mode` and surface the REAL error of the updatedFields attempt
// (not a misleading fallback). Returns the updated doc.
export async function updateInsightResult(auth, { insightID, _id, mode = 'set', result, resultName, tags }) {
  if (!auth?.jwt) throw new Error('Not connected to IOsense.')
  if (!_id) throw new Error('Missing result _id to update.')
  const updatedFields = {}
  if (result !== undefined) updatedFields.result = result
  if (resultName !== undefined) updatedFields.resultName = resultName
  if (tags !== undefined) updatedFields.tags = tags
  // Confirmed by server errors: needs both `mode` ('set'|'replace') and `updatedFields` (object).
  const body = { _id, insightID, mode: mode === 'replace' ? 'replace' : 'set', updatedFields }
  const res = await fetch(`${root(auth.base)}/account/bruce/insightResult/update/singleInsightResult`, {
    method: 'PUT', headers: headers(auth), body: JSON.stringify(body),
  })
  const j = await parseJSON(res)
  if (res.ok && j?.success !== false) return j?.data ?? j
  console.debug('[IOsense] update failed — body:', body, '→ response:', j)
  // surface the full server payload so the offending field is visible in the UI
  const detail = (() => { try { return JSON.stringify(j) } catch { return String(j) } })().slice(0, 500)
  throw new Error(`update ${res.status} — ${detail}`)
}
