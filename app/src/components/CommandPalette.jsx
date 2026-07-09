import { useState, useEffect, useRef } from 'react'
import { useSceneStore } from '../store/sceneStore'
import { MACHINE_LIBRARY } from '../lib/machineLibrary'

const STATUS_DOT = { running: '#00dd66', idle: '#ffaa00', fault: '#ff3344' }

function SectionLabel({ label }) {
  return (
    <p className="BodyXSmallRegular" style={{
      padding: 'var(--spacing-03) var(--spacing-05) var(--spacing-01)',
      color: 'var(--text-default-secondary)', letterSpacing: 1,
      background: '#f5f7fa',
    }}>{label}</p>
  )
}

function ResultRow({ r, active, onHover, onSelect }) {
  return (
    <div
      onClick={onSelect}
      onMouseEnter={onHover}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'var(--spacing-03) var(--spacing-05)',
        background: active ? '#e8f4ff' : 'transparent',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        cursor: 'pointer',
        gap: 'var(--spacing-04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-03)', minWidth: 0 }}>
        {r.kind === 'select' ? (
          <span style={{ width: 8, height: 8, borderRadius: '50%',
            background: STATUS_DOT[r.status], flexShrink: 0 }} />
        ) : (
          <span style={{
            width: 20, height: 20, borderRadius: '50%',
            background: 'var(--background-brand-secondary)',
            border: '1px solid var(--border-brand-default)',
            color: 'var(--text-brand-default)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, flexShrink: 0,
          }}>+</span>
        )}
        <span className="BodySmallMedium" style={{
          color: active ? 'var(--text-brand-default)' : 'var(--text-default-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {r.label}
        </span>
      </div>
      <span className="BodyXSmallRegular" style={{ color: 'var(--text-default-tertiary)', flexShrink: 0 }}>
        {r.sub}
      </span>
    </div>
  )
}

export function CommandPalette({ onClose }) {
  const [query,  setQuery]  = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef()

  const { addObject, objects, selectObject, flyToObject } = useSceneStore()

  useEffect(() => {
    const raf = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [])

  const q = query.toLowerCase().trim()

  const objectMatches = Object.values(objects)
    .filter(o => !q || o.name.toLowerCase().includes(q) || o.type.toLowerCase().includes(q))
    .slice(0, 5)
    .map(o => ({ kind: 'select', id: o.id, label: o.name, sub: o.type, status: o.status }))

  const addMatches = []
  for (const { category, items } of MACHINE_LIBRARY) {
    for (const { type, label } of items) {
      if (!q || label.toLowerCase().includes(q) || type.toLowerCase().includes(q)) {
        addMatches.push({ kind: 'add', type, label, sub: category })
      }
    }
  }
  const addMatchesTrimmed = addMatches.slice(0, 8)

  const results = [...objectMatches, ...addMatchesTrimmed]

  const execute = (r) => {
    if (!r) return
    if (r.kind === 'add') {
      addObject(r.type, [0, 0, 0])
    } else {
      selectObject(r.id)
      flyToObject(r.id)
    }
    onClose()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter')     { e.preventDefault(); execute(results[cursor]) }
  }

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 200,
      }} />
      <div style={{
        position: 'fixed', top: '18%', left: '50%', transform: 'translateX(-50%)',
        width: 560, zIndex: 201,
        background: '#ffffff',
        border: '1px solid rgba(0,0,0,0.10)',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}>
        {/* search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--spacing-04)',
          padding: 'var(--spacing-04) var(--spacing-05)',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="6.5" cy="6.5" r="5" stroke="var(--text-default-tertiary)" strokeWidth="1.5"/>
            <path d="M10.5 10.5L14 14" stroke="var(--text-default-tertiary)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setCursor(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Search objects or add machines…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--text-default-primary)', fontFamily: 'inherit', fontSize: 14,
              padding: 0,
            }}
          />
          <span className="BodyXSmallRegular" style={{
            color: 'var(--text-default-tertiary)',
            background: 'var(--background-default-subtle)',
            padding: '2px 6px', borderRadius: 4,
          }}>ESC</span>
        </div>

        {/* results list */}
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {objectMatches.length > 0 && <SectionLabel label="SCENE OBJECTS" />}
          {objectMatches.map((r, i) => (
            <ResultRow key={r.id} r={r} active={cursor === i}
              onHover={() => setCursor(i)} onSelect={() => execute(r)} />
          ))}

          {addMatchesTrimmed.length > 0 && <SectionLabel label="ADD TO SCENE" />}
          {addMatchesTrimmed.map((r, i) => {
            const idx = objectMatches.length + i
            return (
              <ResultRow key={r.type} r={r} active={cursor === idx}
                onHover={() => setCursor(idx)} onSelect={() => execute(r)} />
            )
          })}

          {results.length === 0 && (
            <p className="BodySmallRegular" style={{
              padding: 'var(--spacing-06)', textAlign: 'center',
              color: 'var(--text-default-tertiary)',
            }}>
              No results for "{query}"
            </p>
          )}
        </div>

        {/* keyboard hints */}
        <div style={{
          padding: 'var(--spacing-03) var(--spacing-05)',
          borderTop: '1px solid rgba(0,0,0,0.07)',
          background: '#fafbfc',
          display: 'flex', gap: 'var(--spacing-06)',
        }}>
          {[['↵', 'confirm'], ['↑↓', 'navigate'], ['ESC', 'close']].map(([key, hint]) => (
            <span key={key} className="BodyXSmallRegular" style={{ color: 'var(--text-default-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <kbd style={{
                fontFamily: 'inherit', background: 'var(--background-default-subtle)',
                padding: '1px 6px', borderRadius: 4,
                border: '1px solid var(--border-gray-default)',
              }}>{key}</kbd>
              {hint}
            </span>
          ))}
        </div>
      </div>
    </>
  )
}
