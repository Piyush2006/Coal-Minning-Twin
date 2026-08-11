// Left sidebar navigation — one item per section with a minimal stroke icon.
// Active = white pill + shadow. When Predictive has critical alerts its icon
// gets a subtle red ring with a minimal heartbeat pulse (no dot). Collapsible
// to an icon-only rail via the button at the bottom.
import { useState } from 'react'

const INK = '#0F1728'

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }
const Icon = ({ children }) => <svg width="17" height="17" viewBox="0 0 24 24" style={{ flexShrink: 0, display: 'block' }} {...S}>{children}</svg>

// minimal geometric icons — guaranteed-clean primitives, no icon font
export const ICONS = {
  production: <Icon><path d="M4 20h16" /><rect x="5.5" y="11" width="3.6" height="6" rx="1.2" /><rect x="10.2" y="6.5" width="3.6" height="10.5" rx="1.2" /><rect x="14.9" y="9" width="3.6" height="8" rx="1.2" /></Icon>,
  efficiency: <Icon><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.8" cy="6.8" r="2.6" /><circle cx="17.2" cy="17.2" r="2.6" /></Icon>,
  equipment: <Icon><circle cx="12" cy="12" r="3.1" /><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1" /></Icon>,
  predictive: <Icon><path d="M3 12h4l2.5-6.5L14 18l2.5-6H21" /></Icon>,
  safety: <Icon><path d="M12 3l7 2.8v5.4c0 4.6-3 7.6-7 9.3-4-1.7-7-4.7-7-9.3V5.8z" /></Icon>,
  depth: <Icon><path d="M12 3.2 21 8l-9 4.8L3 8z" /><path d="m4.8 12.2 7.2 3.9 7.2-3.9" /><path d="m4.8 16.4 7.2 3.9 7.2-3.9" /></Icon>,
}

export function Sidebar({ sections, activeId, onChange, dots = {} }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside style={{ width: collapsed ? 68 : 216, flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '18px 12px', gap: 8, transition: 'width 200ms cubic-bezier(.22,.61,.36,1)' }}>
      {/* nav */}
      <nav style={{ display: 'grid', gap: 3 }}>
        {sections.map(s => {
          const active = s.id === activeId
          const alert = !!dots[s.id]
          return (
            <button key={s.id} onClick={() => onChange(s.id)} className="BodySmallSemibold" title={collapsed ? s.label : undefined}
              onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'rgba(16,24,40,0.04)'; e.currentTarget.style.color = 'var(--text-gray-primary)' } }}
              onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-gray-secondary)' } }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 11, width: '100%', textAlign: 'left', padding: collapsed ? '10px 0' : '10px 12px', borderRadius: 12, border: 'none',
                background: active ? 'var(--background-surface-intense)' : 'transparent',
                color: active ? 'var(--text-gray-primary)' : 'var(--text-gray-secondary)',
                boxShadow: active ? 'var(--fds-shadow-sm)' : 'none',
                cursor: 'pointer', font: 'inherit', transition: 'background 150ms, color 150ms' }}>
              <span className={alert ? 'alert-ring' : undefined}
                style={{ display: 'inline-flex', padding: 4, color: alert ? 'var(--text-error-default)' : active ? INK : 'var(--text-gray-tertiary)' }}>
                {ICONS[s.id]}
              </span>
              {!collapsed && <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{s.label}</span>}
            </button>
          )
        })}
      </nav>

      <span style={{ flex: 1 }} />

      {/* collapse / expand — icon only, tooltip carries the label */}
      <button onClick={() => setCollapsed(c => !c)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand' : 'Collapse'}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16,24,40,0.05)'; e.currentTarget.style.color = 'var(--text-gray-primary)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-gray-tertiary)' }}
        style={{ width: 36, height: 36, alignSelf: collapsed ? 'center' : 'flex-start', marginLeft: collapsed ? 0 : 6, display: 'grid', placeItems: 'center', borderRadius: 10, border: 'none', background: 'transparent', color: 'var(--text-gray-tertiary)', cursor: 'pointer', transition: 'background 150ms, color 150ms' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" {...S} style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}>
          <path d="m15 6-6 6 6 6" /><path d="M4 4v16" />
        </svg>
      </button>
    </aside>
  )
}
