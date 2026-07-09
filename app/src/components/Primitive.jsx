// Generic, fully config-driven asset. One component renders every user-defined
// custom asset type — geometry + color come entirely from `config`, so no new
// code is needed per custom asset. `typeDef` (from customAssetTypes) supplies the
// base primitive when config doesn't override it.
import { finishFor, getFinishMaps } from '../lib/textures'

export function Primitive({ config = {}, typeDef }) {
  const shape = config.shape ?? typeDef?.primitive ?? 'box'
  const color = config.color ?? '#9fb2c4'
  const base = { color, metalness: 0.2, roughness: 0.55 }
  const tx = getFinishMaps(finishFor(base)) || {}
  const mat = { ...base, ...tx, normalScale: tx.normalScale ? [tx.normalScale, tx.normalScale] : undefined }

  if (shape === 'cylinder') {
    const r = config.radius ?? 0.8
    const h = config.height ?? 1.6
    return (
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, h, 28]} />
        <meshStandardMaterial {...mat} />
      </mesh>
    )
  }

  if (shape === 'tank') {
    const r = config.radius ?? 1.0
    const h = config.height ?? 3.0
    return (
      <group>
        <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[r, r, h, 32]} />
          <meshStandardMaterial {...mat} />
        </mesh>
        <mesh position={[0, h, 0]} castShadow>
          <sphereGeometry args={[r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial {...mat} />
        </mesh>
      </group>
    )
  }

  // box (default)
  const w = config.width ?? 1.5
  const h = config.height ?? 1.5
  const d = config.depth ?? 1.5
  return (
    <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial {...mat} />
    </mesh>
  )
}
