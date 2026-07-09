import { Handle, Position } from '@xyflow/react'

const STATUS_DOT = { running: '#34c759', idle: '#ff9f0a', fault: '#ff3b30' }

// Custom node — one clean input (left) + one output (right), n8n-style.
export function FlowNode({ data, selected }) {
  const { name, type, status, params = [], inPort, outPort } = data

  const handle = (kind) => ({
    width: 12, height: 12, borderRadius: '50%', border: '2px solid #fff',
    background: kind === 'out' ? '#0a84ff' : '#b0b0b5',
    boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
  })

  return (
    <div style={{
      width: 196, background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'saturate(180%) blur(12px)', WebkitBackdropFilter: 'saturate(180%) blur(12px)',
      border: selected ? '2px solid #0a84ff' : '1px solid rgba(0,0,0,0.10)',
      borderRadius: 14,
      boxShadow: selected ? '0 4px 18px rgba(10,132,255,0.28)' : '0 1px 2px rgba(0,0,0,0.04), 0 8px 22px rgba(0,0,0,0.09)',
      fontFamily: 'inherit', overflow: 'hidden',
    }}>
      {inPort  && <Handle id={inPort}  type="target" position={Position.Left}  style={handle('in')} />}
      {outPort && <Handle id={outPort} type="source" position={Position.Right} style={handle('out')} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 6px' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_DOT[status] ?? '#8e8e93', flexShrink: 0 }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontSize: 13.5, fontWeight: 600, color: '#1d1d1f' }}>{name}</span>
      </div>
      <div style={{ padding: '0 12px 10px' }}>
        <span style={{ fontSize: 11, color: '#a1a1a6' }}>{type}</span>
        {params.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 7 }}>
            {/* Parameter NAMES only — no live values on the card. */}
            {params.map((label, i) => (
              <span key={i} style={{ background: 'rgba(120,120,128,0.12)', borderRadius: 5,
                padding: '2px 7px', fontSize: 11, color: '#6e6e73' }}>
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
