// Structural platform / mounting stand — a deck on four legs to sit equipment on.
export function MountingStand({ config = {} }) {
  const { width = 2, height = 0.9, depth = 2, color = '#526070' } = config
  const mat = { color, metalness: 0.2, roughness: 0.5 }
  const lx = width / 2 - 0.1
  const lz = depth / 2 - 0.1

  return (
    <group>
      {/* top deck */}
      <mesh position={[0, height, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.1, depth]} />
        <meshStandardMaterial {...mat} />
      </mesh>

      {/* legs */}
      {[[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].map(([x, z], i) => (
        <mesh key={i} position={[x, height / 2, z]} castShadow>
          <boxGeometry args={[0.1, height, 0.1]} />
          <meshStandardMaterial {...mat} />
        </mesh>
      ))}
    </group>
  )
}
