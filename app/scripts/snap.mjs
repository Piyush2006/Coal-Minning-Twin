// Headless self-verification screenshots — drives the dev app (port 5117) via
// the window.__dt hook, creates a fresh project from a template, aims the camera
// at named viewpoints, and saves PNGs for inspection.
//   node scripts/snap.mjs [templateId] [outDir]
import { createRequire } from 'module'
import fs from 'fs'
import os from 'os'
import path from 'path'

const require = createRequire(import.meta.url)
const puppeteer = require('puppeteer')

const TEMPLATE = process.argv[2] || 'bottling-plant'
const OUT = process.argv[3] || '/tmp/claude-1000/snaps'
const URL = 'http://localhost:5117/?snap=1'

// Named viewpoints: [name, camPos, target]
const VIEWS = {
  'bottling-plant': [
    ['overview', [-5, 40, 48], [-2, 0, -2]],
    ['filler',   [-17, 4.5, 7.2],  [-12, 1.3, 2.6]],
    ['labeller', [-3.5, 3.8, 7],  [0.8, 1.1, 3.1]],
    ['packer',   [10, 4.5, 7.5],   [14.5, 1.0, 3.1]],
    ['process',  [-8, 9, 1],    [-5, 1.5, -10]],
  ],
  'thermal-power-plant': [
    ['overview', [-5, 55, 75], [-5, 0, 0]],
    ['boiler',   [-45, 12, 22], [-56, 6, 0]],
    ['turbine',  [14, 8, 14],  [4, 2.5, 0]],
  ],
}

function findChromium() {
  const roots = [path.join(os.homedir(), '.cache/puppeteer'), path.join(os.homedir(), '.cache/ms-playwright')]
  for (const root of roots) {
    if (!fs.existsSync(root)) continue
    const stack = [root]
    while (stack.length) {
      const dir = stack.pop()
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) stack.push(p)
        else if (e.name === 'chrome' || e.name === 'headless_shell' || e.name === 'chrome-headless-shell') return p
      }
    }
  }
  return null
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const opts = {
    headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-sandbox', '--window-size=1100,660'],
    defaultViewport: { width: 1100, height: 660 },
  }
  let browser
  try { browser = await puppeteer.launch(opts) }
  catch {
    const exe = findChromium()
    if (!exe) throw new Error('No chromium binary found')
    browser = await puppeteer.launch({ ...opts, executablePath: exe })
  }
  const page = await browser.newPage()
  page.on('pageerror', (e) => console.log('[pageerror]', e.message?.slice(0, 200)))
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })   // vite HMR socket never idles — don't wait for network
  await sleep(2500)

  // fresh project from the template (opens in view mode)
  const created = await page.evaluate((tpl) => {
    if (!window.__dt?.project) return 'no-hook'
    window.__dt.project.getState().createFromTemplate(tpl, 'SNAP ' + tpl)
    return 'ok'
  }, TEMPLATE)
  if (created !== 'ok') throw new Error('dev hook missing: ' + created)
  await page.waitForSelector('canvas', { timeout: 30000 })
  await sleep(4000)                                     // let textures/instances settle

  const views = VIEWS[TEMPLATE] || VIEWS['bottling-plant']
  for (const [name, pos, tgt] of views) {
    await page.evaluate(({ pos, tgt }) => {
      const oc = window.__dt?.orbit?.current
      if (!oc) return
      oc.object.position.set(pos[0], pos[1], pos[2])
      oc.target.set(tgt[0], tgt[1], tgt[2])
      oc.update()
    }, { pos, tgt })
    await sleep(1200)
    const file = path.join(OUT, `${TEMPLATE}-${name}.png`)
    await page.screenshot({ path: file })
    console.log('saved', file)
  }
  await browser.close()
}

main().catch((e) => { console.error('SNAP FAILED:', e.message); process.exit(1) })
