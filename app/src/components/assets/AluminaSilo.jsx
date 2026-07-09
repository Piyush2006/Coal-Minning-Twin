// Alumina supply silo — tall cylinder with a conical hopper bottom on legs,
// feeding the point feeders on the pots. `outlet` utility port for piping.
export function AluminaSilo({ config = {} }) {
  const { radius = 1.6, height = 4.5, fillLevel = 70, color = '#dfe4ea' } = config
  const mat = { color, metalness: 0.18, roughness: 0.5 }
  const legH = 2.2
  const bodyY = legH + height / 2

  return (
    <group>
      {/* legs */}
      {[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * radius * 0.7, legH / 2, sz * radius * 0.7]} castShadow>
          <boxGeometry args={[0.16, legH, 0.16]} />
          <meshStandardMaterial color="#52606f" metalness={0.3} roughness={0.5} />
        </mesh>
      ))}
      {/* conical hopper bottom */}
      <mesh position={[0, legH - 0.1, 0]} castShadow>
        <coneGeometry args={[radius, 1.1, 28]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* body */}
      <mesh position={[0, bodyY, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, height, 28]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* domed top */}
      <mesh position={[0, legH + height, 0]} castShadow>
        <sphereGeometry args={[radius, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* level band */}
      <mesh position={[radius + 0.04, legH + 0.2 + (height * fillLevel / 100) / 2, 0]}>
        <boxGeometry args={[0.05, Math.max(0.001, height * fillLevel / 100), 0.06]} />
        <meshStandardMaterial color="#0a84ff" emissive="#0a84ff" emissiveIntensity={0.25} transparent opacity={0.8} />
      </mesh>
    </group>
  )
}
