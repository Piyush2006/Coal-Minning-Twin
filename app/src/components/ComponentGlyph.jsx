// Lightweight SVG preview for an asset type — a simplified silhouette per
// shape-class. Cheap (no WebGL), crisp at any size; used in the component modal.
const STEEL = '#9aa6b4', DARK = '#3a3f46', ACCENT = '#0a84ff', YEL = '#f5b50a', COPPER = '#b87333'

// type → shape-class
const SHAPE = {
  Carbonator: 'tank', Tank: 'tank',
  AluminaSilo: 'silo',
  PETFiller: 'rotary', CanFiller: 'rotary', GlassFiller: 'rotary', RotaryCapper: 'rotary', CrownCapper: 'rotary', CanSeamer: 'rotary',
  BottleWasher: 'inline', Labeller: 'inline', DateCoder: 'inline', CheckWeigher: 'inline', EBIInspector: 'inline',
  ConveyorBelt: 'belt',
  Pump: 'pump', Valve: 'valve', PipeSegment: 'pipe', MountingStand: 'stand',
  ReductionPot: 'pot', PotTendingMachine: 'gantry', TappingCrucible: 'crucible',
}

function Shape({ kind }) {
  switch (kind) {
    case 'tank': return <>
      <rect x="13" y="7" width="14" height="26" rx="7" fill={STEEL} />
      <rect x="13" y="20" width="14" height="13" rx="6" fill={ACCENT} opacity="0.5" />
    </>
    case 'silo': return <>
      <rect x="13" y="6" width="14" height="18" rx="6" fill={STEEL} />
      <polygon points="13,24 27,24 22,31 18,31" fill={STEEL} />
      <line x1="16" y1="31" x2="16" y2="35" stroke={DARK} strokeWidth="1.6" />
      <line x1="24" y1="31" x2="24" y2="35" stroke={DARK} strokeWidth="1.6" />
    </>
    case 'rotary': return <>
      <rect x="7" y="13" width="26" height="16" rx="3" fill={STEEL} />
      <circle cx="20" cy="21" r="6" fill="#fff" opacity="0.7" />
      <circle cx="20" cy="21" r="6" fill="none" stroke={ACCENT} strokeWidth="1.6" />
    </>
    case 'inline': return <>
      <rect x="8" y="12" width="24" height="14" rx="3" fill={STEEL} />
      <line x1="7" y1="31" x2="33" y2="31" stroke={DARK} strokeWidth="1.4" />
      {[11, 17, 23, 29].map(x => <circle key={x} cx={x} cy="31" r="1.5" fill={DARK} />)}
    </>
    case 'belt': return <>
      <rect x="6" y="17" width="28" height="6" rx="3" fill={STEEL} />
      <circle cx="10" cy="20" r="4" fill="none" stroke={DARK} strokeWidth="1.6" />
      <circle cx="30" cy="20" r="4" fill="none" stroke={DARK} strokeWidth="1.6" />
    </>
    case 'pump': return <>
      <circle cx="19" cy="20" r="9" fill={STEEL} />
      <polygon points="16,15 25,20 16,25" fill={ACCENT} />
      <rect x="27" y="18" width="6" height="4" fill={STEEL} />
    </>
    case 'valve': return <>
      <polygon points="20,20 11,14 11,26" fill={STEEL} />
      <polygon points="20,20 29,14 29,26" fill={STEEL} />
      <rect x="18.5" y="8" width="3" height="6" fill={DARK} />
    </>
    case 'pipe': return <rect x="5" y="17" width="30" height="6" rx="3" fill={STEEL} />
    case 'stand': return <>
      <rect x="9" y="14" width="22" height="3.5" fill={STEEL} />
      <rect x="11" y="17" width="3" height="12" fill={DARK} />
      <rect x="26" y="17" width="3" height="12" fill={DARK} />
    </>
    case 'pot': return <>
      <polygon points="9,29 31,29 26,13 14,13" fill={DARK} />
      <rect x="13" y="25" width="14" height="3" fill={COPPER} />
    </>
    case 'gantry': return <>
      <rect x="8" y="12" width="24" height="3.5" rx="1" fill={YEL} />
      <rect x="10" y="15" width="3" height="15" fill={STEEL} />
      <rect x="27" y="15" width="3" height="15" fill={STEEL} />
    </>
    case 'crucible': return <>
      <polygon points="11,15 29,15 25,30 15,30" fill={STEEL} />
      <rect x="10" y="13" width="20" height="3" rx="1.5" fill={DARK} />
      <ellipse cx="20" cy="16" rx="8" ry="2" fill={ACCENT} opacity="0.4" />
    </>
    default: return <rect x="11" y="11" width="18" height="18" rx="3" fill={STEEL} />
  }
}

export function ComponentGlyph({ type, size = 36 }) {
  const kind = SHAPE[type] || 'box'
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ display: 'block', flexShrink: 0 }}>
      <rect x="0" y="0" width="40" height="40" rx="9" fill="rgba(10,132,255,0.06)" />
      <Shape kind={kind} />
    </svg>
  )
}
