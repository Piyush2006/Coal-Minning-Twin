// Straight pipe run, centered on its origin and laid along X so its dynamic
// utility ports (±length/2, see getPorts) track the geometry as it resizes.
export function PipeSegment({ config = {} }) {
  const { length = 4, radius = 0.12, color = '#c8d4e0' } = config
  const y = 0.4

  return (
    <group>
      <mesh position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[radius, radius, length, 16]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.4} />
      </mesh>

      {/* end flanges */}
      {[-length / 2, length / 2].map((x, i) => (
        <mesh key={i} position={[x, y, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[radius * 1.6, radius * 1.6, 0.06, 16]} />
          <meshStandardMaterial color="#9fb0c0" metalness={0.5} roughness={0.35} />
        </mesh>
      ))}
    </group>
  )
}
