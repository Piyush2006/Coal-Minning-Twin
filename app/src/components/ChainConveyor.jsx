import { useMemo } from 'react'

export function ChainConveyor({ start, end, z = 0, height = 0.92 }) {
  const cx  = (start + end) / 2
  const len = Math.abs(end - start)

  const legXs = useMemo(() => {
    const xs = []
    const half = len / 2 - 0.25
    for (let x = -half; x <= half; x += 1.8) xs.push(x)
    return xs
  }, [len])

  return (
    <group position={[cx, 0, z]}>
      {/* chain surface */}
      <mesh position={[0, height, 0]} receiveShadow>
        <boxGeometry args={[len, 0.04, 0.48]} />
        <meshStandardMaterial color="#7a8a9a" metalness={0.6} roughness={0.45} />
      </mesh>

      {/* bottle guide rails (amber — beverage standard) */}
      {[-0.26, 0.26].map((dz, i) => (
        <mesh key={i} position={[0, height + 0.075, dz]}>
          <boxGeometry args={[len, 0.1, 0.04]} />
          <meshStandardMaterial color="#cc7700" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}

      {/* legs */}
      {legXs.map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          {[-0.2, 0.2].map((dz, j) => (
            <mesh key={j} position={[0, height / 2, dz]}>
              <boxGeometry args={[0.06, height, 0.06]} />
              <meshStandardMaterial color="#2e3c4a" metalness={0.65} roughness={0.4} />
            </mesh>
          ))}
          <mesh position={[0, height * 0.38, 0]}>
            <boxGeometry args={[0.06, 0.04, 0.45]} />
            <meshStandardMaterial color="#263240" metalness={0.65} roughness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
