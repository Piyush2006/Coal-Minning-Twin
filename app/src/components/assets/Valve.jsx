// Inline manual valve — body on a through-pipe with a handwheel that turns and
// goes green when `open`. Inlet/outlet stubs match the utility ports.
export function Valve({ config = {} }) {
  const { open = true, color = '#a8442f' } = config

  return (
    <group>
      {/* through pipe */}
      <mesh position={[0, 0.3, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 0.7, 12]} />
        <meshStandardMaterial color="#c8d4e0" metalness={0.4} roughness={0.4} />
      </mesh>

      {/* valve body */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.5} />
      </mesh>

      {/* stem */}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.25, 8]} />
        <meshStandardMaterial color="#c8d4e0" metalness={0.5} roughness={0.3} />
      </mesh>

      {/* handwheel (rotates + turns green when open) */}
      <group position={[0, 0.7, 0]} rotation={[0, open ? 0.6 : 0, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.14, 0.025, 8, 20]} />
          <meshStandardMaterial color={open ? '#00aa55' : '#8a93a0'} metalness={0.4} roughness={0.4} />
        </mesh>
      </group>
    </group>
  )
}
