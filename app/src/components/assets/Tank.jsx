// Storage / process tank — vertical vessel with domed top, legs, a live fill
// gauge, and a side outlet that lines up with the `outlet` utility port.
export function Tank({ config = {} }) {
  const { radius = 1.1, height = 3.2, fillLevel = 60, color = '#cdd6e2' } = config
  const mat = { color, metalness: 0.2, roughness: 0.45 }

  const legH = 0.6
  const bodyY = legH + height / 2
  const liqH = Math.max(0.001, (height - 0.2) * (fillLevel / 100))
  const lx = radius * 0.62

  return (
    <group>
      {/* support legs */}
      {[[-lx, -lx], [lx, -lx], [-lx, lx], [lx, lx]].map(([x, z], i) => (
        <mesh key={i} position={[x, legH / 2, z]} castShadow>
          <boxGeometry args={[0.1, legH, 0.1]} />
          <meshStandardMaterial color="#526070" metalness={0.2} roughness={0.5} />
        </mesh>
      ))}

      {/* body */}
      <mesh position={[0, bodyY, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, height, 32]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {/* domed top */}
      <mesh position={[0, legH + height, 0]} castShadow>
        <sphereGeometry args={[radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial {...mat} />
      </mesh>

      {/* level sight gauge (rises with fill %) */}
      <mesh position={[radius + 0.05, legH + 0.1 + liqH / 2, 0]}>
        <boxGeometry args={[0.06, liqH, 0.06]} />
        <meshStandardMaterial color="#3fa8d8" emissive="#1f6f9a" emissiveIntensity={0.35}
          transparent opacity={0.85} />
      </mesh>

      {/* side outlet pipe (matches `outlet` port) */}
      <mesh position={[0, 0.5, radius * 0.8]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.7, 12]} />
        <meshStandardMaterial color="#c8d4e0" metalness={0.3} roughness={0.4} />
      </mesh>
    </group>
  )
}
