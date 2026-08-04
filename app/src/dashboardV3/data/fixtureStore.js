// Fixture store — loads a recorded fixture (columnar binary + manifest) and
// serves it through the plane contract the screens bind to. Uniform sample
// stride per tier ⇒ timestamp lookup is pure arithmetic (O(1), no scan).
//
//   const fx = await loadFixture('/fixtures/golden-shift')   (browser, fetch)
//   fx.at('crusher-1·throughput', tMs)          → value at t
//   fx.series('crusher-1·throughput', a, b, n)  → ≤n [t, v] pairs
//   fx.snapshot(tMs, ['crusher-1', ...])        → { id: { params, status } }  — live-plane shape
//
// The same file works under Node (bench, tests) via loadFixtureNode().

export function makeStore(manifest, bin) {
  const dtA = (manifest.dt ?? 1) * 1000
  const dtB = (manifest.dtB ?? manifest.dt ?? 1) * 1000
  const tierB = new Set(manifest.tierB ?? [])
  const t0 = manifest.clockStart ?? manifest.t0
  const cols = new Map()
  for (const [key, m] of Object.entries(manifest.cols)) {
    const arr = m.type === 'u8'
      ? new Uint8Array(bin.buffer, bin.byteOffset + m.offset, m.length)
      : new Float32Array(bin.buffer, bin.byteOffset + m.offset, m.length)
    cols.set(key, { arr, dt: tierB.has(key.split('·')[0]) ? dtB : dtA })
  }
  const statusEnum = manifest.statusEnum ?? ['running', 'idle', 'fault', 'off']

  const idxOf = (c, tMs) => {
    const i = Math.floor((tMs - t0) / c.dt)
    return i < 0 ? 0 : i >= c.arr.length ? c.arr.length - 1 : i
  }
  const at = (key, tMs) => { const c = cols.get(key); if (!c) return undefined; const v = c.arr[idxOf(c, tMs)]; return Number.isNaN(v) ? undefined : v }

  // asset → param list (derived once)
  const assetParams = new Map()
  for (const key of cols.keys()) {
    const [id, param] = key.split('·')
    if (param.startsWith('§')) continue
    if (!assetParams.has(id)) assetParams.set(id, [])
    assetParams.get(id).push(param)
  }

  return {
    manifest, t0,
    tEnd: t0 + Math.max(...[...cols.values()].map(c => c.arr.length * c.dt)),
    cols: [...cols.keys()],
    at,
    series(key, tFrom, tTo, maxPoints = 2000) {
      const c = cols.get(key); if (!c) return []
      const i0 = idxOf(c, tFrom), i1 = idxOf(c, tTo)
      const stride = Math.max(1, Math.ceil((i1 - i0 + 1) / maxPoints))
      const out = []
      for (let i = i0; i <= i1; i += stride) { const v = c.arr[i]; if (!Number.isNaN(v)) out.push([t0 + i * c.dt, v]) }
      return out
    },
    snapshot(tMs, ids) {
      const out = {}
      for (const id of ids ?? assetParams.keys()) {
        const params = {}
        for (const p of assetParams.get(id) ?? []) { const v = at(`${id}·${p}`, tMs); if (v !== undefined) params[p] = v }
        const st = cols.get(`${id}·§status`)
        out[id] = { parameters: params, status: st ? statusEnum[st.arr[idxOf(st, tMs)]] : 'running' }
      }
      return out
    },
  }
}

export async function loadFixture(base) {
  const [manifest, bin] = await Promise.all([
    fetch(`${base}.meta.json`).then(r => r.json()),
    fetch(`${base}.bin`).then(r => r.arrayBuffer()).then(b => new Uint8Array(b)),
  ])
  return makeStore(manifest, bin)
}

export async function loadFixtureNode(dir, name) {
  const fs = await import('fs')
  const manifest = JSON.parse(fs.readFileSync(`${dir}/${name}.meta.json`, 'utf8'))
  const bin = fs.readFileSync(`${dir}/${name}.bin`)
  return makeStore(manifest, new Uint8Array(bin.buffer, bin.byteOffset, bin.byteLength))
}
