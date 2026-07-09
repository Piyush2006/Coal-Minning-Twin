#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Headless text-to-3D → app-ready glTF. Generates a detailed model from a prompt
// via Meshy or Tripo, downloads the GLB, (optionally) optimises it, drops it into
// public/models/<slug>/, and prints a ready-to-paste `Model` asset config + a
// `kind:'model'` part snippet (for use inside a Component Spec).
//
// Usage:
//   MESHY_API_KEY=…  node scripts/gen-model.mjs --prompt "industrial ball mill" --slug ball_mill
//   TRIPO_API_KEY=…  node scripts/gen-model.mjs --provider tripo --prompt "control cabinet" --slug cabinet
//
// Flags: --prompt <text> (required) · --slug <name> (required) · --provider meshy|tripo
//        --style realistic|sculpture · --no-refine (Meshy: skip the textured refine pass)
//
// Optimisation (Draco): if @gltf-transform/core + @gltf-transform/functions are
// installed it runs automatically; otherwise the raw GLB is kept (still loads — the
// app's GLBModel decodes draco/meshopt, so optimise later with `gltf-transform`).
// ─────────────────────────────────────────────────────────────────────────────
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function arg(name, def = undefined) {
  const i = process.argv.indexOf(`--${name}`)
  if (i >= 0) return process.argv[i + 1]?.startsWith('--') || i + 1 >= process.argv.length ? true : process.argv[i + 1]
  return def
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function poll(fn, { tries = 120, every = 5000, label = 'task' } = {}) {
  for (let i = 0; i < tries; i++) {
    const s = await fn()
    if (s.done) return s
    process.stdout.write(`\r  ${label}: ${s.status || 'working'} ${s.progress != null ? `${s.progress}%` : ''}   `)
    await sleep(every)
  }
  throw new Error(`${label} timed out`)
}

// ── Meshy (openapi v2 text-to-3d: preview → refine) ──────────────────────────
async function meshy({ prompt, style, refine }) {
  const key = process.env.MESHY_API_KEY
  if (!key) throw new Error('Set MESHY_API_KEY (https://meshy.ai → API).')
  const H = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  const base = 'https://api.meshy.ai/openapi/v2/text-to-3d'
  const create = async (body) => {
    const r = await fetch(base, { method: 'POST', headers: H, body: JSON.stringify(body) })
    const j = await r.json(); if (!r.ok) throw new Error(`meshy ${r.status}: ${JSON.stringify(j)}`)
    return j.result
  }
  const status = async (id) => {
    const r = await fetch(`${base}/${id}`, { headers: H }); const j = await r.json()
    return { done: j.status === 'SUCCEEDED', failed: j.status === 'FAILED', status: j.status, progress: j.progress, glb: j?.model_urls?.glb, raw: j }
  }
  const previewId = await create({ mode: 'preview', prompt, art_style: style === 'sculpture' ? 'sculpture' : 'realistic', should_remesh: true })
  let s = await poll(() => status(previewId), { label: 'meshy preview' })
  if (s.failed) throw new Error('meshy preview failed')
  if (refine) {
    const refineId = await create({ mode: 'refine', preview_task_id: previewId, enable_pbr: true })
    s = await poll(() => status(refineId), { label: 'meshy refine' })
    if (s.failed) throw new Error('meshy refine failed')
  }
  if (!s.glb) throw new Error('meshy: no glb url in result')
  return s.glb
}

// ── Tripo (v2 openapi: text_to_model) ────────────────────────────────────────
async function tripo({ prompt }) {
  const key = process.env.TRIPO_API_KEY
  if (!key) throw new Error('Set TRIPO_API_KEY (https://platform.tripo3d.ai → API).')
  const H = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  const r = await fetch('https://api.tripo3d.ai/v2/openapi/task', { method: 'POST', headers: H, body: JSON.stringify({ type: 'text_to_model', prompt }) })
  const j = await r.json(); if (!r.ok) throw new Error(`tripo ${r.status}: ${JSON.stringify(j)}`)
  const id = j?.data?.task_id
  const status = async () => {
    const rr = await fetch(`https://api.tripo3d.ai/v2/openapi/task/${id}`, { headers: H }); const jj = await rr.json()
    const d = jj?.data || {}
    return { done: d.status === 'success', failed: ['failed', 'cancelled', 'banned'].includes(d.status), status: d.status, progress: d.progress, glb: d?.output?.model || d?.output?.pbr_model, raw: jj }
  }
  const s = await poll(status, { label: 'tripo' })
  if (s.failed || !s.glb) throw new Error('tripo: generation failed / no model url')
  return s.glb
}

// ── Optional Draco optimisation (best-effort) ────────────────────────────────
async function optimize(buf) {
  try {
    const { NodeIO } = await import('@gltf-transform/core')
    const { draco } = await import('@gltf-transform/extensions').catch(() => ({}))
    const { dedup, prune, weld, draco: dracoFn } = await import('@gltf-transform/functions')
    const io = new NodeIO()
    const doc = await io.readBinary(new Uint8Array(buf))
    await doc.transform(dedup(), prune(), weld())
    if (dracoFn) { try { await doc.transform(dracoFn()) } catch { /* draco encoder optional */ } }
    const out = await io.writeBinary(doc)
    return { buf: Buffer.from(out), optimized: true }
  } catch {
    return { buf: Buffer.from(buf), optimized: false }
  }
}

async function main() {
  const prompt = arg('prompt'), slug = arg('slug')
  if (!prompt || prompt === true || !slug || slug === true) {
    console.error('Usage: node scripts/gen-model.mjs --prompt "<text>" --slug <name> [--provider meshy|tripo] [--style realistic|sculpture] [--no-refine]')
    process.exit(1)
  }
  const provider = arg('provider', 'meshy'), style = arg('style', 'realistic'), refine = !process.argv.includes('--no-refine')
  console.log(`Generating "${prompt}" via ${provider} …`)
  const url = provider === 'tripo' ? await tripo({ prompt }) : await meshy({ prompt, style, refine })
  console.log(`\n↓ downloading ${url.slice(0, 80)}…`)
  const dl = await fetch(url); if (!dl.ok) throw new Error(`download ${dl.status}`)
  const raw = await dl.arrayBuffer()
  const { buf, optimized } = await optimize(raw)
  const rel = `models/${slug}/${slug}.glb`
  const abs = resolve(ROOT, 'public', rel)
  await mkdir(dirname(abs), { recursive: true })
  await writeFile(abs, buf)
  const mb = (buf.length / 1e6).toFixed(2)
  console.log(`\n✓ wrote public/${rel}  (${mb} MB${optimized ? ', draco-optimised' : ', raw — install @gltf-transform/* to optimise'})`)
  console.log('\n— Place as a standalone Model asset (config):')
  console.log(JSON.stringify({ type: 'Model', name: slug, config: { url: `/${rel}`, fit: 4, scale: 1, yaw: 0 } }, null, 2))
  console.log('\n— Or drop into a Component Spec as a detailed body part (kind:"model"):')
  console.log(JSON.stringify({ id: `part_${slug}`, label: slug, kind: 'model', url: `/${rel}`, fit: 2, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, null, 2))
}

main().catch(e => { console.error(`\n✗ ${e.message}`); process.exit(1) })
