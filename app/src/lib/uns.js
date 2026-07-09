// Resolve IOsense UNS topics to their latest values in one batched call.
//   POST {base}/account/uns/resolveAndCompute
//   { graph, config:[{key,topic}], startTime, endTime }  →  { data:[{key,value}] }
// Auth: Authorization: Bearer <token>. Topics may be wrapped in {{ }} (stripped).
export async function resolveTopics({ token, baseUrl, graph }, items) {
  if (!token || !items?.length) return {}
  const now = Date.now()
  const bearer = token.startsWith('Bearer ') ? token : `Bearer ${token}`
  const url = `${(baseUrl || 'https://stagingsv.iosense.io/api').replace(/\/$/, '')}/account/uns/resolveAndCompute`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: bearer },
    body: JSON.stringify({
      graph: graph || 'iosense_test_uns',
      config: items.map(it => ({ key: it.key, topic: String(it.topic).replace(/^\{\{|\}\}$/g, '').trim() })),
      startTime: now - 86_400_000,
      endTime: now,
    }),
  })
  if (!res.ok) throw new Error(`UNS ${res.status} ${res.statusText}`)
  const json = await res.json()
  const out = {}
  for (const d of (json?.data || [])) out[d.key] = d.value
  return out
}
