// Section tabs — pill tabs (active = white pill + shadow, inactive = text with a
// soft hover). A red dot rides the Predictive tab whenever critical alerts > 0.
export function SectionNav({ sections, activeId, onChange, dots = {} }) {
  return (
    <div style={{ display: 'flex', gap: 6, padding: '9px 28px', background: 'rgba(244,246,251,.86)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderTop: '1px solid var(--border-gray-subtle)', borderBottom: '1px solid var(--border-gray-subtle)', overflowX: 'auto', position: 'relative', zIndex: 1 }}>
      {sections.map(s => {
        const active = s.id === activeId
        return (
          <button key={s.id} onClick={() => onChange(s.id)} className="BodySmallSemibold"
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--background-surface-subtle)' }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
            style={{
              position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 15px', borderRadius: 999,
              border: `1px solid ${active ? 'var(--border-gray-subtle)' : 'transparent'}`,
              background: active ? 'var(--background-surface-intense)' : 'transparent',
              color: active ? 'var(--text-gray-primary)' : 'var(--text-gray-secondary)',
              boxShadow: active ? 'var(--fds-shadow-sm)' : 'none',
              cursor: 'pointer', font: 'inherit', whiteSpace: 'nowrap', transition: 'background 150ms, color 150ms',
            }}>
            {s.label}
            {dots[s.id] && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--background-error-default)', boxShadow: '0 0 0 3px var(--background-error-secondary)' }} />}
          </button>
        )
      })}
    </div>
  )
}
