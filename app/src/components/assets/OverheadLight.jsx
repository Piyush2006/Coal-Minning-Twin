// Light — an overhead light fixture that ACTUALLY emits light (unlike a custom
// component, whose lens is only an emissive material). A metal housing + glowing
// lens, plus real point lights cast downward so it illuminates the floor below.
//
// It mounts itself at `config.mountHeight` within its own group, so dropping it
// from the library (which places objects at floor level) still puts it overhead;
// move/raise it with the gizmo as needed. Appearance + output are all config-driven.
// Three.js (r0.169) uses physically-based light units — a point light's
// `intensity` is candela and falls off with decay². So the friendly 0–20
// "Intensity" slider is scaled up to real candela here, and we use a gentler
// decay so the light actually reaches and pools on the floor several metres below.
const INTENSITY_SCALE = 22
const DECAY = 1.6

export function OverheadLight({ config = {} }) {
  const length    = config.length ?? 9
  const color     = config.color ?? '#eaf2ff'
  const intensity = config.intensity ?? 6
  const range     = config.range ?? 34
  const on        = config.on ?? true
  const mount     = config.mountHeight ?? 6

  const lens = on ? color : '#3a3f47'
  const cd   = intensity * INTENSITY_SCALE
  // Spread a few point lights along the bar so a long fixture lights evenly,
  // capped so it stays cheap.
  const n  = Math.min(4, Math.max(1, Math.round(length / 4)))
  const xs = Array.from({ length: n }, (_, i) => (n === 1 ? 0 : -length / 2 + (i + 0.5) * (length / n)))

  return (
    <group position={[0, mount, 0]}>
      {/* housing */}
      <mesh castShadow>
        <boxGeometry args={[length, 0.14, 0.56]} />
        <meshStandardMaterial color="#9aa3ad" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* glowing lens */}
      <mesh position={[0, -0.08, 0]}>
        <boxGeometry args={[length, 0.12, 0.5]} />
        <meshStandardMaterial color={lens} emissive={lens} emissiveIntensity={on ? 3.2 : 0} metalness={0} roughness={1} />
      </mesh>
      {/* emitted light along the bar — physically-scaled candela, gentle decay.
          Each emitter carries full candela (they barely overlap along a long bar),
          so a longer fixture throws MORE total light, not the same amount split. */}
      {on && xs.map((x, i) => (
        <pointLight key={i} position={[x, -0.25, 0]} color={color} intensity={cd} distance={range} decay={DECAY} />
      ))}
    </group>
  )
}
