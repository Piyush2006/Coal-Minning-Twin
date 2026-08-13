// Detection boxes — a legible SEQUENCE, not a box that pops:
//   see → SCAN (a projector beam from the camera + a feathered light plane
//   sweeps down the body while the reticle snaps in and confidence ticks up) →
//   VERDICT (the corner-bracket box locks in with its result).
//   • PPE compliant   → GREEN  "SAFETY COMPLIANT"
//   • PPE violation   → RED    "SAFETY VIOLATION DETECTED — missing …"
//   • proximity warn  → AMBER  "ENTERING PROXIMITY ZONE — <vehicle>"   (no scan)
//   • proximity danger→ RED    "PROXIMITY DANGER — <vehicle> · N m · AUTO-STOP"
// Proximity outranks PPE. Bloom does the glow. Fixed slot pool, imperative.
import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useSceneStore } from '../../store/sceneStore'
import { workerPosMap } from '../../lib/workerPosMap'
import { workerBreachInfo } from '../../lib/proximity'
import { ppeCameraDetections, PPE_LABEL } from '../../lib/ppeVision'
import { pushLiveSafety } from '../../lib/liveSafetyFeed'
import { scanMat, flowMat } from './safetyShaders'

const GREEN = '#12B76A', RED = '#F04438', AMBER = '#F79009', SCAN = '#5CC8FF'
const SLOTS = 8
const SCAN_S = 1.6, RESCAN_GAP = 8, HEAD_Y = 3.6
const mono = "'SF Mono', ui-monospace, Menlo, monospace"
const _up = new THREE.Vector3(0, 1, 0), _dir = new THREE.Vector3(), _mid = new THREE.Vector3(), _q = new THREE.Quaternion(), _a = new THREE.Vector3(), _b = new THREE.Vector3()

// corner-bracket cage (8 corners × 3 short arms) around a ~human box
const BRACKET_GEO = (() => {
  const w = 0.72, h = 1.9, d = 0.58, L = 0.2
  const hw = w / 2, hh = h / 2, hd = d / 2, p = []
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * hw, y = sy * hh, z = sz * hd
    p.push(x, y, z, x - sx * L, y, z, x, y, z, x, y - sy * L, z, x, y, z, x, y, z - sz * L)
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); return g
})()
const SWEEP_GEO = new THREE.PlaneGeometry(0.82, 0.66)
const BEAM_GEO = new THREE.CylinderGeometry(0.085, 0.03, 1, 12, 1, true)   // wide at camera, narrow at worker

function DetectionSlot({ reg }) {
  const group = useRef(), boxGrp = useRef(), lineMat = useRef(), labelDiv = useRef(), beam = useRef(), sweep = useRef()
  const mats = useMemo(() => ({ beam: flowMat(SCAN), sweep: scanMat() }), [])
  mats.beam.uniforms.uDir.value = -1
  useEffect(() => {
    reg({ group: group.current, boxGrp: boxGrp.current, lineMat: lineMat.current, beam: beam.current, sweep: sweep.current, mats, get label() { return labelDiv.current } })
    return () => reg(null)
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group ref={group} visible={false}>
      <group ref={boxGrp}>
        <lineSegments geometry={BRACKET_GEO} renderOrder={999}>
          <lineBasicMaterial ref={lineMat} color={GREEN} transparent opacity={0.95} toneMapped={false} depthTest={false} blending={THREE.AdditiveBlending} />
        </lineSegments>
      </group>
      <mesh ref={beam} geometry={BEAM_GEO} material={mats.beam} renderOrder={998} visible={false} />
      <mesh ref={sweep} geometry={SWEEP_GEO} material={mats.sweep} rotation={[-Math.PI / 2, 0, 0]} renderOrder={998} visible={false} />
      <Html position={[0, 1.28, 0]} center distanceFactor={7} zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={labelDiv} style={{ fontFamily: mono, fontSize: 11, fontWeight: 800, letterSpacing: 0.3, color: '#fff',
          background: GREEN, border: '1px solid rgba(255,255,255,0.45)', borderRadius: 4, padding: '2px 7px',
          whiteSpace: 'nowrap', textTransform: 'uppercase', boxShadow: '0 1px 6px rgba(0,0,0,0.4)' }}>—</div>
      </Html>
    </group>
  )
}

const scanState = new Map()   // wid -> { phase, t0, camId, compliant, gone }

// Tour hook: clear the given workers' scan state so their full see→scan→verdict
// sequence replays on the next detection tick — deleting several at once makes
// their sweeps run SYNCHRONIZED (same t0), verdicts landing together.
export function rescanWorkers(ids = []) {
  for (const id of ids) scanState.delete(id)
}

export function DetectionBoxLayer() {
  const slots = useRef(new Array(SLOTS).fill(null))
  const camKey = useSceneStore(s => Object.keys(s.objects).filter(id => s.objects[id].type === 'ppe_camera').sort().join(','))
  const camIds = useMemo(() => (camKey ? camKey.split(',') : []), [camKey])
  const camPos = useMemo(() => { const o = useSceneStore.getState().objects, m = {}; for (const id of camIds) { const p = o[id]?.position; if (p) m[id] = [p[0], HEAD_Y, p[2]] } return m }, [camIds])
  const frame = useRef(0)

  useFrame(({ clock }) => {
    if ((frame.current++ % 3) !== 0) return
    const now = clock.elapsedTime
    const ppe = new Map()
    for (const cid of camIds) for (const d of ppeCameraDetections(cid)) { if (!ppe.has(d.id) || !d.compliant) ppe.set(d.id, { ...d, camId: cid }) }
    // scan state machine (PPE only; proximity skips to a box)
    for (const [wid, d] of ppe) {
      const br = workerBreachInfo(wid)
      if (br && (br.state === 'danger' || br.state === 'warn')) { scanState.delete(wid); continue }
      const ss = scanState.get(wid)
      if (!ss || (ss.gone != null && now - ss.gone > RESCAN_GAP) || (ss && ss.compliant !== d.compliant)) scanState.set(wid, { phase: 'scan', t0: now, camId: d.camId, compliant: d.compliant })
      else {
        ss.gone = null; ss.camId = d.camId
        if (ss.phase === 'scan' && now - ss.t0 > SCAN_S) {
          ss.phase = 'verdict'
          // verdict lands → a violation is written to the management Safety data
          if (!d.compliant && !ss.logged) {
            ss.logged = true
            const miss = d.missing.map(m => PPE_LABEL[m]).join(', ')
            pushLiveSafety({ cat: 'PPE', severity: 'High', description: `Missing ${miss} — CV vision flag`, location: 'CHP Gate', camera: (useSceneStore.getState().objects[d.camId]?.name || d.camId || 'CV-04') })
          }
        }
      }
    }
    for (const [wid, ss] of scanState) if (!ppe.has(wid) && ss.gone == null) ss.gone = now

    const boxes = []
    for (const [wid, w] of workerPosMap) {
      const br = workerBreachInfo(wid)
      let color = null, label = null, phase = 'verdict', camId = null, conf = 96
      if (br && br.state === 'danger') { color = RED; label = `⚠ PROXIMITY DANGER · ${br.vehName} · ${Math.round(br.dist)} m · AUTO-STOP` }
      else if (br && br.state === 'warn') { color = AMBER; label = `ENTERING PROXIMITY ZONE · ${br.vehName}` }
      else if (ppe.has(wid)) {
        const d = ppe.get(wid), ss = scanState.get(wid); camId = d.camId; conf = d.conf ?? 96
        if (ss && ss.phase === 'scan') { color = SCAN; phase = 'scan' }
        else if (d.compliant) { color = GREEN; label = 'SAFETY COMPLIANT' }
        else { color = RED; label = `SAFETY VIOLATION DETECTED · missing ${d.missing.map(m => PPE_LABEL[m]).join(', ')}` }
      }
      if (color) boxes.push({ x: w.pos.x, y: w.pos.y, z: w.pos.z, color, label, phase, camId, conf, t0: scanState.get(wid)?.t0 ?? 0 })
    }

    const pulse = 0.65 + 0.35 * Math.sin(now * 6)
    for (let i = 0; i < SLOTS; i++) {
      const s = slots.current[i]; if (!s || !s.group) continue
      const bx = boxes[i]
      if (!bx) { s.group.visible = false; continue }
      s.group.visible = true
      s.group.position.set(bx.x, bx.y + 0.94, bx.z)
      const scanning = bx.phase === 'scan'
      const prog = scanning ? Math.min(1, (now - bx.t0) / SCAN_S) : 1
      // reticle snaps in during the scan
      if (s.boxGrp) { const k = scanning ? 1 + (1 - prog) * 0.4 : 1; s.boxGrp.scale.setScalar(k) }
      if (s.lineMat) { s.lineMat.color.set(bx.color); s.lineMat.opacity = scanning ? 0.2 + prog * 0.75 : (bx.color === GREEN ? 0.95 : pulse) }
      // projector beam camera→chest (transform unit cylinder in slot-local frame)
      if (s.beam) {
        if (scanning && bx.camId && camPos[bx.camId]) {
          const h = camPos[bx.camId]
          _a.set(0, 0.15, 0); _b.set(h[0] - bx.x, h[1] - (bx.y + 0.94), h[2] - bx.z)
          _dir.subVectors(_b, _a); const len = _dir.length(); _mid.addVectors(_a, _b).multiplyScalar(0.5)
          _q.setFromUnitVectors(_up, _dir.clone().normalize())
          s.beam.visible = true; s.beam.position.copy(_mid); s.beam.quaternion.copy(_q); s.beam.scale.set(1, len, 1)
          s.mats.beam.uniforms.uTime.value = now; s.mats.beam.uniforms.uOpacity.value = 0.9
        } else s.beam.visible = false
      }
      // feathered body-scan plane travels top→bottom
      if (s.sweep) {
        if (scanning) { s.sweep.visible = true; s.sweep.position.y = 0.95 - prog * 1.9; s.mats.sweep.uniforms.uTime.value = now; s.mats.sweep.uniforms.uOpacity.value = 0.95 * (1 - Math.abs(prog - 0.5) * 0.5) }
        else s.sweep.visible = false
      }
      const div = s.label
      const text = scanning ? `SCANNING ${Math.round(prog * bx.conf)}%` : bx.label
      if (div && (div._t !== text || div._c !== bx.color)) { div.textContent = text; div.style.background = bx.color; div._t = text; div._c = bx.color }
    }
  })

  return <>{Array.from({ length: SLOTS }).map((_, i) => <DetectionSlot key={i} reg={(o) => { slots.current[i] = o }} />)}</>
}
