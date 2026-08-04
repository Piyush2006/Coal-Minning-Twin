// §9 anti-fatigue policy, applied at READ time over the RAW recorded alert
// transition log. The fixture stores every fire/resolve; this module decides
// what deserves attention — so the policy can be retuned without regenerating
// the fixture, and K22 (alert precision / flap rate) can be computed from the
// raw stream it filters.
//
//   raw:      [{ t, type:'fire'|'resolve', key, objId?, sev?, useCase?, msg? }]
//   returns:  [{ key, objId, sev, useCase, msg, firstT, lastT, episodes, flaps }]
//             — one item per alert episode that survives the policy, ordered by firstT.

export const DEFAULT_POLICY = {
  fireAfterS: 120,      // must stay active this long before it exists
  resolveAfterS: 180,   // must stay quiet this long before it resolves
  refractoryS: 900,     // a resolved key cannot re-fire within this window (flap → one episode)
}

export function applyAlertPolicy(raw, upToT = Infinity, policy = DEFAULT_POLICY) {
  // reconstruct per-key active intervals from transitions
  const intervals = new Map()   // key -> { spans: [[t0,t1|null]], meta }
  for (const e of raw) {
    if (e.t > upToT) break
    let r = intervals.get(e.key)
    if (!r) { r = { spans: [], meta: null }; intervals.set(e.key, r) }
    if (e.type === 'fire') { r.spans.push([e.t, null]); if (!r.meta) r.meta = e }
    else { const last = r.spans[r.spans.length - 1]; if (last && last[1] == null) last[1] = e.t }
  }
  const out = []
  for (const [key, r] of intervals) {
    // merge spans separated by < resolveAfterS (hysteresis), then drop short ones
    const merged = []
    for (const [a, b] of r.spans) {
      const end = b ?? upToT
      const last = merged[merged.length - 1]
      if (last && a - last.end < policy.resolveAfterS) { last.end = Math.max(last.end, end); last.flaps++ }
      else merged.push({ start: a, end, flaps: 0 })
    }
    // refractory: episodes closer than refractoryS collapse into one
    const episodes = []
    for (const m of merged) {
      const last = episodes[episodes.length - 1]
      if (last && m.start - last.end < policy.refractoryS) { last.end = m.end; last.flaps += m.flaps + 1 }
      else episodes.push({ ...m })
    }
    for (const ep of episodes) {
      if (ep.end - ep.start < policy.fireAfterS) continue                       // never survived long enough
      out.push({ key, objId: r.meta?.objId, sev: r.meta?.sev, useCase: r.meta?.useCase, msg: r.meta?.msg,
        firstT: ep.start, lastT: ep.end, active: ep.end >= upToT, flaps: ep.flaps })
    }
  }
  out.sort((a, b) => a.firstT - b.firstT)
  return out
}

/** K22 raw material: transitions vs surviving episodes (flap suppression rate). */
export function alertStats(raw, policy = DEFAULT_POLICY) {
  const fires = raw.filter(e => e.type === 'fire').length
  const surviving = applyAlertPolicy(raw, Infinity, policy).length
  return { rawFires: fires, surviving, suppressed: fires - surviving }
}
