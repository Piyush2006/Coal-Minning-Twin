// Detection boxes — the image-processing overlay the client asked for: a camera
// scans a worker and draws a corner-bracket box around them with a verdict.
//   • PPE camera zone, compliant   → GREEN  "SAFETY COMPLIANT"
//   • PPE camera zone, missing kit → RED    "SAFETY VIOLATION DETECTED — missing …"
//   • proximity warning            → AMBER  "ENTERING PROXIMITY ZONE — <vehicle>"
//   • proximity danger             → RED    "PROXIMITY DANGER — <vehicle> · N m · AUTO-STOP"
// Proximity outranks PPE (the more urgent hazard). ALWAYS live (not gated on the
// 🦺 layer) so clients see it immediately; a fixed slot pool follows the workers
// imperatively (no per-frame React re-renders).
import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useSceneStore } from '../../store/sceneStore'
import { workerPosMap } from '../../lib/workerPosMap'
import { workerBreachInfo } from '../../lib/proximity'
import { ppeCameraDetections, PPE_LABEL } from '../../lib/ppeVision'

const GREEN = '#12B76A', RED = '#F04438', AMBER = '#F79009'
const SLOTS = 8
const mono = "'SF Mono', ui-monospace, Menlo, monospace"

// shared corner-bracket box geometry (8 corners × 3 short arms) around a ~human box
const BRACKET_GEO = (() => {
  const w = 0.72, h = 1.9, d = 0.58, L = 0.18
  const hw = w / 2, hh = h / 2, hd = d / 2
  const p = []
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * hw, y = sy * hh, z = sz * hd
    p.push(x, y, z, x - sx * L, y, z)
    p.push(x, y, z, x, y - sy * L, z)
    p.push(x, y, z, x, y, z - sz * L)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
  return g
})()

function DetectionSlot({ reg }) {
  const group = useRef(), lineMat = useRef(), labelDiv = useRef()
  useEffect(() => {
    reg({ group: group.current, lineMat: lineMat.current, get label() { return labelDiv.current } })
    return () => reg(null)
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group ref={group} visible={false}>
      <lineSegments geometry={BRACKET_GEO} renderOrder={999}>
        <lineBasicMaterial ref={lineMat} color={GREEN} transparent opacity={0.95} toneMapped={false} depthTest={false} />
      </lineSegments>
      <Html position={[0, 1.22, 0]} center distanceFactor={7} zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={labelDiv} style={{ fontFamily: mono, fontSize: 11, fontWeight: 800, letterSpacing: 0.2, color: '#fff',
          background: GREEN, border: '1px solid rgba(255,255,255,0.4)', borderRadius: 4, padding: '2px 6px',
          whiteSpace: 'nowrap', textTransform: 'uppercase', boxShadow: '0 1px 4px rgba(0,0,0,0.35)' }}>—</div>
      </Html>
    </group>
  )
}

export function DetectionBoxLayer() {
  const slots = useRef(new Array(SLOTS).fill(null))
  const camKey = useSceneStore(s => Object.keys(s.objects).filter(id => s.objects[id].type === 'ppe_camera').sort().join(','))
  const camIds = useMemo(() => (camKey ? camKey.split(',') : []), [camKey])
  const frame = useRef(0)

  useFrame(({ clock }) => {
    if ((frame.current++ % 3) !== 0) return
    // merge PPE detections across all cameras (a violation wins over a duplicate compliant)
    const ppe = new Map()
    for (const cid of camIds) for (const d of ppeCameraDetections(cid)) {
      if (!ppe.has(d.id) || !d.compliant) ppe.set(d.id, d)
    }
    // build the box list (proximity outranks PPE)
    const boxes = []
    for (const [wid, w] of workerPosMap) {
      const br = workerBreachInfo(wid)
      let color = null, label = null
      if (br && br.state === 'danger') { color = RED; label = `⚠ PROXIMITY DANGER · ${br.vehName} · ${Math.round(br.dist)} m · AUTO-STOP` }
      else if (br && br.state === 'warn') { color = AMBER; label = `ENTERING PROXIMITY ZONE · ${br.vehName}` }
      else if (ppe.has(wid)) {
        const d = ppe.get(wid)
        if (d.compliant) { color = GREEN; label = 'SAFETY COMPLIANT' }
        else { color = RED; label = `SAFETY VIOLATION DETECTED · missing ${d.missing.map(m => PPE_LABEL[m]).join(', ')}` }
      }
      if (color) boxes.push({ x: w.pos.x, y: w.pos.y, z: w.pos.z, color, label })
    }
    const pulse = 0.7 + 0.3 * Math.sin(clock.elapsedTime * 6)
    for (let i = 0; i < SLOTS; i++) {
      const s = slots.current[i]; if (!s || !s.group) continue
      const bx = boxes[i]
      if (bx) {
        s.group.visible = true
        s.group.position.set(bx.x, bx.y + 0.94, bx.z)
        if (s.lineMat) { s.lineMat.color.set(bx.color); s.lineMat.opacity = bx.color === GREEN ? 0.95 : pulse }
        const div = s.label
        if (div && (div._t !== bx.label || div._c !== bx.color)) { div.textContent = bx.label; div.style.background = bx.color; div._t = bx.label; div._c = bx.color }
      } else s.group.visible = false
    }
  })

  return <>{Array.from({ length: SLOTS }).map((_, i) => <DetectionSlot key={i} reg={(o) => { slots.current[i] = o }} />)}</>
}
