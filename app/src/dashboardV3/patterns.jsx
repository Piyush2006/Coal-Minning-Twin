// Status colours + mandatory pattern fills (brief §3.1). Seven statuses, each
// with a non-colour secondary encoding so state survives greyscale/CVD — status
// is safety information. Mount <StatusPatternDefs/> once per page; reference
// fills via statusFill(key).
//
// Encoding: solid = definitive (operating / unplanned down); hatches = idle
// (wide = justified, tight = unjustified); cross-hatch = planned down;
// dots = degraded; vertical stripe = no data.

export const STATUS = {
  operating:   { label: 'Operating',           color: '#12A16E', pattern: null },
  idleJ:       { label: 'Idle — justified',    color: '#E0A32E', pattern: 'dv3-pat-idlej' },
  idleU:       { label: 'Idle — unjustified',  color: '#EC7C30', pattern: 'dv3-pat-idleu' },
  downU:       { label: 'Down — unplanned',    color: '#E04B4B', pattern: null },
  downP:       { label: 'Down — planned',      color: '#9AA4B4', pattern: 'dv3-pat-downp' },
  degraded:    { label: 'Degraded / at risk',  color: '#F0913A', pattern: 'dv3-pat-degraded' },
  nodata:      { label: 'No data / gap',       color: '#DCE1E9', pattern: 'dv3-pat-nodata' },
}

export const statusFill = (key) => {
  const s = STATUS[key]
  return s?.pattern ? `url(#${s.pattern})` : (s?.color ?? '#DCE1E9')
}

export function StatusPatternDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        {/* wide diagonal hatch — idle (justified) */}
        <pattern id="dv3-pat-idlej" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="9" height="9" fill={STATUS.idleJ.color} />
          <line x1="0" y1="0" x2="0" y2="9" stroke="#fff" strokeWidth="3" strokeOpacity="0.55" />
        </pattern>
        {/* tight diagonal hatch — idle (unjustified) */}
        <pattern id="dv3-pat-idleu" width="4.5" height="4.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="4.5" height="4.5" fill={STATUS.idleU.color} />
          <line x1="0" y1="0" x2="0" y2="4.5" stroke="#fff" strokeWidth="1.6" strokeOpacity="0.55" />
        </pattern>
        {/* cross-hatch — down (planned) */}
        <pattern id="dv3-pat-downp" width="7" height="7" patternUnits="userSpaceOnUse">
          <rect width="7" height="7" fill={STATUS.downP.color} />
          <path d="M0 0L7 7M7 0L0 7" stroke="#fff" strokeWidth="1.4" strokeOpacity="0.55" />
        </pattern>
        {/* dotted — degraded / at risk */}
        <pattern id="dv3-pat-degraded" width="7" height="7" patternUnits="userSpaceOnUse">
          <rect width="7" height="7" fill={STATUS.degraded.color} />
          <circle cx="3.5" cy="3.5" r="1.4" fill="#fff" fillOpacity="0.7" />
        </pattern>
        {/* vertical stripe — no data / gap */}
        <pattern id="dv3-pat-nodata" width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill={STATUS.nodata.color} />
          <rect x="0" width="3" height="6" fill="#fff" fillOpacity="0.85" />
        </pattern>
      </defs>
    </svg>
  )
}

/* small swatch chip: pattern-filled rect + label */
export function StatusChip({ k }) {
  const s = STATUS[k]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
      <svg width="22" height="14" style={{ borderRadius: 3, flexShrink: 0 }}>
        <rect width="22" height="14" rx="3" fill={statusFill(k)} />
      </svg>
      {s.label}
    </span>
  )
}

/* a segmented state bar — the visual language of the equipment Gantt rows */
export function StatusBar({ segments, height = 18, width = 420 }) {
  const total = segments.reduce((a, s) => a + s.w, 0)
  let x = 0
  return (
    <svg width={width} height={height} style={{ borderRadius: 4, display: 'block' }}>
      {segments.map((s, i) => {
        const w = (s.w / total) * width
        const el = <rect key={i} x={x} width={Math.max(0, w - 1)} height={height} rx={2} fill={statusFill(s.k)} />
        x += w
        return el
      })}
    </svg>
  )
}
