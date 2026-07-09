import { useMemo } from 'react'

export function Floor() {
  const lights = useMemo(() => {
    const pos = []
    for (let x = -26; x <= 18; x += 8)
      for (let z = -10; z <= 10; z += 8)
        pos.push([x, 10.5, z])
    return pos
  }, [])

  return (
    <>
      {lights.map(([x, y, z], i) => (
        <pointLight key={i} position={[x, y, z]} color="#fff8f0" intensity={1.8} distance={20} decay={2} />
      ))}
    </>
  )
}
