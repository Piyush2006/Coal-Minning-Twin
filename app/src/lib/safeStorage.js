// ─────────────────────────────────────────────────────────────────────────────
// Quota-safe localStorage adapter for zustand persist. Chat messages can carry
// image thumbnails; localStorage has a hard ~5 MB budget and zustand writes on
// EVERY set — an unhandled QuotaExceeded would silently kill all persistence.
// On overflow we prune the SERIALIZED payload (never the in-memory state) in
// tiers and retry; worst case we drop the one write with a console warning.
// ─────────────────────────────────────────────────────────────────────────────

// prune(state, tier) → smaller state (tier 1, 2, …). Return null when out of tiers.
export function quotaSafeStorage({ prune }) {
  return {
    getItem: (k) => localStorage.getItem(k),
    removeItem: (k) => localStorage.removeItem(k),
    setItem: (k, v) => {
      try { localStorage.setItem(k, v); return } catch { /* quota — prune below */ }
      let payload
      try { payload = JSON.parse(v) } catch { console.warn('[storage] quota hit; payload unparseable — write dropped'); return }
      for (let tier = 1; tier <= 3; tier++) {
        const pruned = prune?.(payload.state, tier)
        if (!pruned) break
        payload = { ...payload, state: pruned }
        try { localStorage.setItem(k, JSON.stringify(payload)); console.warn(`[storage] quota hit — persisted a tier-${tier} pruned copy`); return } catch { /* next tier */ }
      }
      console.warn('[storage] quota exceeded — this write was dropped (state kept in memory)')
    },
  }
}

// Prune tiers for the projects store: 1) drop chat image thumbs everywhere but
// the 10 newest messages overall, 2) trim every chat to its last 50 messages,
// 3) drop thumbs entirely.
export function pruneProjectsState(state, tier) {
  if (!state?.projects) return null
  const projects = {}
  const all = []   // [{pid, idx, msg}] in store order ≈ chronological per project
  for (const [pid, p] of Object.entries(state.projects)) {
    projects[pid] = { ...p, chat: (p.chat || []).map(m => ({ ...m })) }
    projects[pid].chat.forEach((m, idx) => { if (m.thumbs) all.push({ pid, idx }) })
  }
  if (tier === 1) {
    const keep = new Set(all.slice(-10).map(x => `${x.pid}:${x.idx}`))
    for (const { pid, idx } of all) if (!keep.has(`${pid}:${idx}`)) delete projects[pid].chat[idx].thumbs
  } else if (tier === 2) {
    for (const pid in projects) projects[pid].chat = projects[pid].chat.slice(-50)
  } else if (tier === 3) {
    for (const pid in projects) for (const m of projects[pid].chat) delete m.thumbs
  } else return null
  return { ...state, projects }
}
