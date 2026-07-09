import { useMemo } from 'react'

const MAT_RAIL = { color: '#3a3f4a', metalness: 0.75, roughness: 0.3 }
const MAT_ROLLER = { color: '#505a66', metalness: 0.7, roughness: 0.25 }
const MAT_LEG = { color: '#2e3340', metalness: 0.7, roughness: 0.35 }

function Roller({ x, height }) {
  return (
    <mesh position={[x, height + 0.06, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[0.09, 0.09, 0.55, 12]} />
      <meshStandardMaterial {...MAT_ROLLER} />
    </mesh>
  )
}

export function RollerConveyor({ start, end, z = 0, height = 1.05 }) {
  const cx = (start + end) / 2
  const length = Math.abs(end - start)

  const rollerXs = useMemo(() => {
    const xs = []
    const step = 0.45
    const half = length / 2 - 0.15
    for (let x = -half; x <= half; x += step) xs.push(x)
    return xs
  }, [length])

  const legSpacing = 1.8
  const legXs = useMemo(() => {
    const xs = []
    const half = length / 2 - 0.2
    for (let x = -half; x <= half; x += legSpacing) xs.push(x)
    return xs
  }, [length])

  return (
    <group position={[cx, 0, z]}>
      {/* side rails */}
      {[-0.27, 0.27].map((dz, i) => (
        <mesh key={i} position={[0, height, dz]} castShadow>
          <boxGeometry args={[length, 0.06, 0.06]} />
          <meshStandardMaterial {...MAT_RAIL} />
        </mesh>
      ))}

      {/* rollers */}
      {rollerXs.map((x, i) => (
        <Roller key={i} x={x} height={height} />
      ))}

      {/* legs */}
      {legXs.map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          {[-0.25, 0.25].map((dz, j) => (
            <mesh key={j} position={[0, height / 2, dz]} castShadow>
              <boxGeometry args={[0.06, height, 0.06]} />
              <meshStandardMaterial {...MAT_LEG} />
            </mesh>
          ))}
          {/* cross brace */}
          <mesh position={[0, height * 0.35, 0]}>
            <boxGeometry args={[0.06, 0.05, 0.55]} />
            <meshStandardMaterial {...MAT_LEG} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
