// Perf metrics harness (headless-valid, RELATIVE metrics — SwiftShader FPS is
// not real-GPU FPS, but frame cadence, long-task counts, tick cost, storage
// writes and subscriber counts compare meaningfully across builds).
//
//   node scripts/perf.mjs [--mode twin|dashboard]
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { chromium } = require('/home/ubuntu/workspace/16f8c65d-ce31-4444-82b6-dcd3cd92752e/node_modules/playwright-core')

const URL = process.env.PARITY_URL || 'http://localhost:5420'
const MODE = process.argv.includes('--mode') ? process.argv[process.argv.indexOf('--mode') + 1] : 'twin'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch({
  executablePath: '/home/ubuntu/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
await page.addInitScript(() => {
  window.__perf = { setItems: 0, setItemBytes: 0 }
  const oi = Storage.prototype.setItem
  Storage.prototype.setItem = function (k, v) { window.__perf.setItems++; window.__perf.setItemBytes += (v?.length || 0); return oi.call(this, k, v) }
})
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
if (MODE === 'twin') { await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '3D Twin')?.click() }); await sleep(2500) }

const res = await page.evaluate(async () => {
  const out = { longTasks: 0, longTaskMs: 0, tickMs: [], frames: 0, deltas: [] }
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { out.longTasks++; out.longTaskMs += e.duration } }).observe({ type: 'longtask', buffered: false }) } catch {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'dt-tick') out.tickMs.push(Math.round(e.duration * 10) / 10) }).observe({ type: 'measure', buffered: false }) } catch {}
  const w0 = { ...window.__perf }
  let last = performance.now()
  const raf = () => { const t = performance.now(); out.deltas.push(t - last); last = t; out.frames++; if (t - t0 < 15000) requestAnimationFrame(raf) }
  const t0 = performance.now()
  requestAnimationFrame(raf)
  await new Promise((r) => setTimeout(r, 15200))
  out.deltas.sort((a, b) => a - b)
  const mean = out.deltas.reduce((a, b) => a + b, 0) / (out.deltas.length || 1)
  return {
    mode: undefined,
    seconds: 15,
    frames: out.frames,
    frameDeltaMeanMs: Math.round(mean * 10) / 10,
    frameDeltaP95Ms: Math.round((out.deltas[Math.floor(out.deltas.length * 0.95)] || 0) * 10) / 10,
    longTasks: out.longTasks,
    longTaskMs: Math.round(out.longTaskMs),
    tickMs: out.tickMs,
    setItemsDuringWindow: window.__perf.setItems - w0.setItems,
    setItemKBDuringWindow: Math.round((window.__perf.setItemBytes - w0.setItemBytes) / 1024),
    useFrameSubscribers: window.__dt?.frameSubCount ? window.__dt.frameSubCount() : null,
  }
})
console.log(JSON.stringify({ mode: MODE, ...res }, null, 1))
await browser.close()
