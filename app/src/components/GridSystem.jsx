import { Grid } from '@react-three/drei'
import { useSceneStore } from '../store/sceneStore'
import { mixHex } from '../lib/paletteTokens'

// Scene-config-driven grid. `environment.grid` (any twin can set it):
//   { show?: bool, opacity?: 0..1, desaturate?: bool, cellColor?, sectionColor? }
// drei's Grid has no true opacity uniform, so "opacity" is emulated by blending
// the line colours toward the background — visually equivalent on a lit floor.
const BG = '#eef1f3'

export function GridSystem({ editMode }) {
  const gridCfg = useSceneStore(s => s.environment)?.grid ?? {}

  // View / presentation mode: a single MUTED reference grid (desaturated,
  // ~10% strength by default). Hidden entirely with { show: false } or when the
  // scene declares no grid config (previous behaviour: clean floor).
  if (!editMode) {
    if (gridCfg.show === false || Object.keys(gridCfg).length === 0) return null
    const op = gridCfg.opacity ?? 0.1
    const desat = gridCfg.desaturate !== false
    const cell = mixHex(gridCfg.cellColor ?? (desat ? '#8a949c' : '#b8d0e8'), BG, Math.max(0, 1 - op * 2.2))
    const section = mixHex(gridCfg.sectionColor ?? (desat ? '#75808a' : '#00c8ff'), BG, Math.max(0, 1 - op * 3))
    return (
      <Grid
        position={[0, 0.006, 0]}
        material-depthWrite={false}
        cellSize={2}
        cellThickness={0.5}
        cellColor={cell}
        sectionSize={10}
        sectionThickness={1.0}
        sectionColor={section}
        fadeDistance={520}
        fadeStrength={1.1}
        infiniteGrid
      />
    )
  }

  return (
    <>
      {/* 2m base grid. Lifted a hair off the floor + depthWrite off so it
          overlays cleanly without z-fighting. */}
      <Grid
        position={[0, 0.006, 0]}
        material-depthWrite={false}
        cellSize={2}
        cellThickness={0.6}
        cellColor="#b8d0e8"
        sectionSize={10}
        sectionThickness={1.4}
        sectionColor="#00c8ff"
        fadeDistance={650}
        fadeStrength={0.9}
        infiniteGrid
      />
      {/* 0.5m medium grid — visible when camera within ~60 units */}
      <Grid
        position={[0, 0.012, 0]}
        material-depthWrite={false}
        cellSize={0.5}
        cellThickness={0.35}
        cellColor="#ccdcee"
        sectionSize={2}
        sectionThickness={0.7}
        sectionColor="#66aacc"
        fadeDistance={60}
        fadeStrength={1.2}
        infiniteGrid
      />
      {/* 0.1m fine grid — only when very close */}
      <Grid
        position={[0, 0.02, 0]}
        material-depthWrite={false}
        cellSize={0.1}
        cellThickness={0.2}
        cellColor="#ddeefa"
        sectionSize={0.5}
        sectionThickness={0.3}
        sectionColor="#99ccee"
        fadeDistance={12}
        fadeStrength={2.0}
        infiniteGrid
      />
    </>
  )
}
