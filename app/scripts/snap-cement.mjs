// Headless snapshot of the cement-plant template. Uses puppeteer-core against the
// cached Playwright Chromium. node scripts/snap-cement.mjs [outDir]
import { createRequire } from 'module'
import fs from 'fs'; import os from 'os'; import path from 'path'
const require = createRequire(import.meta.url)
const puppeteer = require('puppeteer-core')

const OUT = process.argv[2] || '/tmp/claude-1000/snaps'
const TEMPLATE = 'cement-plant'
const URL = 'http://localhost:5117/?snap=1'

function findChromium() {
  const roots = [path.join(os.homedir(), '.cache/ms-playwright'), path.join(os.homedir(), '.cache/puppeteer')]
  for (const root of roots) {
    if (!fs.existsSync(root)) continue
    const stack = [root]
    while (stack.length) {
      const dir = stack.pop()
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) stack.push(p)
        else if (/^(chrome|headless_shell|chrome-headless-shell)$/.test(e.name)) return p
      }
    }
  }
  return null
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// [name, camPos, target]. Plant spans x≈-52..46, z≈-16..16.
const VIEWS = [
  ['refmatch',  [-58, 44, 78],  [-4, 3, 2]],   // roughly the reference iso angle
  ['overview',  [-4, 78, 110],  [-4, 0, 0]],
  ['left',      [-58, 24, 40],  [-42, 3, 4]],
  ['bridge',    [-30, 26, 30],  [-18, 6, -12]], // overhead drum pipe bridge
  ['kiln',      [10, 20, 44],   [10, 4, -4]],
  ['util',      [42, 18, 40],   [40, 3, 2]],
]

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const exe = findChromium()
  if (!exe) throw new Error('no chromium')
  const browser = await puppeteer.launch({
    executablePath: exe, headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-sandbox', '--window-size=1600,900'],
    defaultViewport: { width: 1600, height: 900 },
  })
  const page = await browser.newPage()
  page.on('pageerror', (e) => console.log('[pageerror]', e.message?.slice(0, 200)))
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await sleep(2500)
  const created = await page.evaluate((tpl) => {
    if (!window.__dt?.project) return 'no-hook'
    window.__dt.project.getState().createFromTemplate(tpl, 'SNAP ' + tpl)
    return 'ok'
  }, TEMPLATE)
  if (created !== 'ok') throw new Error('dev hook missing: ' + created)
  await page.waitForSelector('canvas', { timeout: 30000 })
  await sleep(4000)
  for (const [name, pos, tgt] of VIEWS) {
    await page.evaluate(({ pos, tgt }) => {
      const oc = window.__dt?.orbit?.current
      if (!oc) return
      oc.object.position.set(pos[0], pos[1], pos[2]); oc.target.set(tgt[0], tgt[1], tgt[2]); oc.update()
    }, { pos, tgt })
    await sleep(1200)
    const file = path.join(OUT, `cement-${name}.png`)
    await page.screenshot({ path: file })
    console.log('saved', file)
  }
  await browser.close()
}
main().catch((e) => { console.error('SNAP FAILED:', e.message); process.exit(1) })
