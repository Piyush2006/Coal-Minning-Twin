// Visual-parity harness: loads the Blackridge template, freezes the sim +
// frame loop at a fixed time with seeded randomness, captures a fixed set of
// app states, and pixel-compares against baselines.
//
//   node scripts/parity.mjs --baseline     # (re)record baselines
//   node scripts/parity.mjs                # compare current build vs baselines
//
// Fail: > 0.02 % pixels differing (per-channel delta > 2 counts as differing).
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

const require = (await import('module')).createRequire(import.meta.url)
const { chromium } = require('/home/ubuntu/workspace/16f8c65d-ce31-4444-82b6-dcd3cd92752e/node_modules/playwright-core')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE_DIR = join(ROOT, 'scripts', 'parity-baseline')
const OUT_DIR = join(ROOT, 'scripts', 'parity-out')
const URL = process.env.PARITY_URL || 'http://localhost:5420'
const RECORD = process.argv.includes('--baseline')
mkdirSync(BASE_DIR, { recursive: true }); mkdirSync(OUT_DIR, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch({
  executablePath: '/home/ubuntu/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
const cdp = await page.context().newCDPSession(page)
// determinism BEFORE any module runs: seeded RNG + frozen Date.now
await page.addInitScript(() => {
  let s = 1234567
  Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
  const t0 = 1785600000000
  Date.now = () => t0
  const OD = Date
  // eslint-disable-next-line no-global-assign
  Date = class extends OD { constructor(...a) { a.length ? super(...a) : super(t0) } static now() { return t0 } }
})
await page.emulateMedia({ reducedMotion: 'reduce' })
page.on('pageerror', (e) => console.error('PAGE ERROR:', String(e).slice(0, 200)))

await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.evaluate(() => { try { localStorage.clear() } catch {} })
await page.reload({ waitUntil: 'domcontentloaded' })
await sleep(6000)
const click = (t) => page.evaluate((x) => {
  const el = [...document.querySelectorAll('div,button')].filter((e) => e.textContent && e.textContent.includes(x) && e.textContent.length < 400).pop()
  if (!el) return false
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, view: window })); return true
}, t)
await click('From Template'); await sleep(3500)
await click('Blackridge'); await sleep(12000)

// freeze the world
await page.evaluate(() => window.__dt.freeze(42))
await sleep(500)
const step = async (n = 1) => { await page.evaluate((k) => { for (let i = 0; i < k; i++) window.__dt.step() }, n); await sleep(120) }

const shots = []
async function shot(name) {
  await step(2)
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(RECORD ? BASE_DIR : OUT_DIR, `${name}.png`), Buffer.from(data, 'base64'))
  shots.push(name)
  console.log(`  captured ${name}`)
}

// ── state set ──
const S = () => page.evaluate(() => window.__dt.scene.getState())
// dashboard overview first (landing view)
await shot('dash-overview')
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Monitoring')?.click() }); await sleep(800)
await shot('dash-monitoring')
// twin
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '3D Twin')?.click() }); await sleep(1500)
await shot('twin-overview')
// close views via flyTo (then settle frames)
for (const [name, id] of [['twin-crusher', 'crusher-1'], ['twin-port', 'ship-1'], ['twin-pit', 'exc-ob-1']]) {
  await page.evaluate((oid) => { const st = window.__dt.scene.getState(); st.flyToObject(oid) }, id)
  for (let i = 0; i < 90; i++) await page.evaluate(() => window.__dt.step())   // let the fly lerp complete under frozen clock
  await sleep(200)
  await shot(name)
}
// selection pop settled
await page.evaluate(() => { const st = window.__dt.scene.getState(); st.selectObject('crusher-1') })
for (let i = 0; i < 80; i++) await page.evaluate(() => window.__dt.step())
await shot('twin-selected')
// alert-active view (force a param over threshold)
await page.evaluate(() => { const st = window.__dt.scene.getState(); st.updateObject('crusher-1', { parameters: { ...st.objects['crusher-1'].parameters, vibration: 12 } }) })
for (let i = 0; i < 30; i++) await page.evaluate(() => window.__dt.step())
await shot('twin-alert')
await page.evaluate(() => { const st = window.__dt.scene.getState(); st.clearSelection?.() })

console.log(RECORD ? `\nBaselines recorded: ${shots.length}` : '\nComparing…')
if (!RECORD) {
  let fails = 0
  for (const name of shots) {
    const a = PNG.sync.read(readFileSync(join(BASE_DIR, `${name}.png`)))
    const b = PNG.sync.read(readFileSync(join(OUT_DIR, `${name}.png`)))
    if (a.width !== b.width || a.height !== b.height) { console.log(`  ${name}: SIZE MISMATCH`); fails++; continue }
    const diff = new PNG({ width: a.width, height: a.height })
    const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.008 })
    const pct = (n / (a.width * a.height)) * 100
    const ok = pct <= 0.02
    console.log(`  ${name}: ${n} px (${pct.toFixed(4)} %) ${ok ? 'OK' : 'FAIL'}`)
    if (!ok) { writeFileSync(join(OUT_DIR, `${name}.diff.png`), PNG.sync.write(diff)); fails++ }
  }
  console.log(fails === 0 ? 'PARITY: PASS' : `PARITY: ${fails} FAILURES`)
  process.exitCode = fails === 0 ? 0 : 1
}
await browser.close()
