// Section tabs — selecting a tab switches the page. Custom underline tabs on
// design-sdk tokens (the SDK Tabs component's internal stacking leaked above the
// toolbar popovers, and its selected state read poorly here).
export function SectionNav({ sections, activeId, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2, padding: '0 16px', background: 'var(--background-surface-intense)', borderTop: '1px solid var(--border-gray-subtle)', boxShadow: 'var(--fds-shadow-sm)', overflowX: 'auto', position: 'relative', zIndex: 1 }}>
      {sections.map(s => {
        const active = s.id === activeId
        return (
          <button key={s.id} onClick={() => onChange(s.id)}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
              padding: '11px 14px', whiteSpace: 'nowrap', fontSize: 14,
              color: active ? 'var(--text-brand-default)' : 'var(--text-gray-secondary)',
              fontWeight: active ? 650 : 500,
              borderBottom: `2px solid ${active ? 'var(--text-brand-default)' : 'transparent'}`,
              marginBottom: -1,
            }}>
            {s.label}
          </button>
        )
      })}
    </div>
  )
}
