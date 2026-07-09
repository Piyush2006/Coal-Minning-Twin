import { MeshReflectorMaterial } from '@react-three/drei'

// Floor — the shopfloor ground slab as a first-class, selectable scene object.
// Geometry/appearance come entirely from `config` (size, color, finish, aisle
// lanes), so it edits through the standard settings panel like any other asset.
// The slab lies in the XZ plane (mesh baked to -90° about X); the wrapping
// SceneObject group applies the object's position/rotation/scale on top.
// Deliberately does NOT receive the directional shadow map (that painted
// aliased patches as machines moved) — ground shadowing comes from ContactShadows.
export function FloorPlane({ config = {} }) {
  const w         = config.width ?? 150
  const d         = config.depth ?? 56
  const color     = config.color ?? '#f2f2f3'
  const metalness = config.metalness ?? 0
  const roughness = config.roughness ?? 0.95
  const showLanes = config.showLanes ?? true
  const laneColor = config.laneColor ?? '#e8b53a'
  const reflective = config.reflective ?? true   // subtle wet-floor sheen (drei reflector)

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        {reflective ? (
          <MeshReflectorMaterial
            resolution={512} mixBlur={1} blur={[400, 100]} mixStrength={0.3} mirror={0}
            depthScale={0.9} minDepthThreshold={0.4} maxDepthThreshold={1.25}
            color={color} metalness={0.15} roughness={Math.min(roughness, 0.85)} />
        ) : (
          <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
        )}
      </mesh>
      {showLanes && [-3.4, 3.4].map((z, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, z]}>
          <planeGeometry args={[Math.max(w - 36, 1), 0.18]} />
          <meshStandardMaterial color={laneColor} roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}
