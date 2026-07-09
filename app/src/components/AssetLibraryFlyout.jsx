import { useState } from 'react'
import { Button } from '@faclon-labs/design-sdk/Button'
import { useSceneStore } from '../store/sceneStore'
import { MACHINE_LIBRARY, groupCustomTypes } from '../lib/machineLibrary'
import { C, R, glass } from '../ui/theme'

const ADD_BTN = {
  width: 26, height: 26, borderRadius: '50%',
  background: C.accent, border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16,
  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0,
}

// Slide-out asset palette anchored beside the 280px sidebar. Imports assets into
// the workspace (3D scene + flow graph) and hosts the custom-asset creator.
export function AssetLibraryFlyout({ canClose = false }) {
  const { addObject, addCustomAssetType, customAssetTypes, toggleAssetLibrary, setFlowNodePosition } = useSceneStore()
  const [showCreator, setShowCreator] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPrim, setNewPrim] = useState('box')
  const [query, setQuery] = useState('')

  const randPos = () => [(Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6]
  const seedFlow = (id) => {
    const n = Object.keys(useSceneStore.getState().objects).length
    setFlowNodePosition(id, { x: 40 + (n * 46) % 460, y: 40 + Math.floor((n * 46) / 460) * 130 })
  }
  const place = (type, layer) => { const id = addObject(type, randPos(), layer); seedFlow(id) }
  const createCustom = () => {
    const typeId = addCustomAssetType({ label: newName.trim() || 'Custom Asset', primitive: newPrim, layer: 'equipment' })
    const oid = addObject(typeId, randPos(), 'equipment'); seedFlow(oid)
    setNewName(''); setNewPrim('box'); setShowCreator(false)
  }

  const q = query.toLowerCase().trim()
  const match = (label) => !q || label.toLowerCase().includes(q)

  const catLabel = {
    padding: '14px 16px 6px', fontSize: 11, fontWeight: 600, letterSpacing: 0.4,
    textTransform: 'uppercase', color: C.text3,
  }
  const itemRow = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '7px 8px 7px 16px', margin: '1px 8px', borderRadius: R.sm,
  }

  return (
    <div style={{ width: 288, height: '100%', flexShrink: 0, ...glass,
      borderLeft: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', borderBottom: `1px solid ${C.line}` }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Components</h3>
        {canClose && (
          <button onClick={toggleAssetLibrary} title="Close" style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: C.text3, fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
        )}
      </div>

      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.line}` }}>
        <input type="text" placeholder="Search assets…" value={query} onChange={(e) => setQuery(e.target.value)}
          style={{ width: '100%', padding: '7px 10px', fontFamily: 'inherit', fontSize: 12.5,
            border: `1px solid ${C.line}`, borderRadius: R.sm, color: C.text, background: 'rgba(120,120,128,0.08)' }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {MACHINE_LIBRARY.map(({ category, items }) => {
          const shown = items.filter(it => match(it.label))
          if (shown.length === 0) return null
          return (
            <div key={category}>
              <p style={catLabel}>{category}</p>
              {shown.map(item => (
                <div key={item.type} style={itemRow}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ fontSize: 13, color: C.text }}>{item.label}</span>
                  <button onClick={() => place(item.type, item.layer)} style={ADD_BTN}>+</button>
                </div>
              ))}
            </div>
          )
        })}

        {groupCustomTypes(customAssetTypes, match).map(({ category, items }) => (
          <div key={category}>
            <p style={catLabel}>{category}</p>
            {items.map(ct => (
              <div key={ct.id} style={itemRow}>
                <span style={{ fontSize: 13, color: C.text }}>{ct.label}</span>
                <button onClick={() => place(ct.id, ct.layer)} style={ADD_BTN}>+</button>
              </div>
            ))}
          </div>
        ))}

        {showCreator ? (
          <div style={{ padding: 'var(--spacing-04) var(--spacing-05)', display: 'flex',
            flexDirection: 'column', gap: 'var(--spacing-03)', background: 'var(--background-default-subtle)' }}>
            <input type="text" placeholder="Asset name" value={newName} onChange={(e) => setNewName(e.target.value)}
              style={{ padding: 'var(--spacing-02) var(--spacing-03)', fontFamily: 'inherit', fontSize: 12,
                border: '1px solid var(--border-gray-default)', borderRadius: 'var(--global-border-radius-small)',
                color: 'var(--text-default-primary)' }} />
            <div style={{ display: 'flex', gap: 'var(--spacing-02)' }}>
              {['box', 'cylinder', 'tank'].map(p => (
                <button key={p} onClick={() => setNewPrim(p)} style={{
                  flex: 1, padding: 'var(--spacing-02) 0',
                  background: newPrim === p ? 'var(--background-brand-secondary)' : 'transparent',
                  border: newPrim === p ? '1px solid var(--border-brand-default)' : '1px solid var(--border-gray-default)',
                  borderRadius: 'var(--global-border-radius-medium)',
                  color: newPrim === p ? 'var(--text-brand-default)' : 'var(--text-default-secondary)',
                  cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize',
                }}>
                  <span className="BodyXSmallRegular">{p}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-02)' }}>
              <Button label="Create" variant="Primary" color="Primary" size="Small" isFullWidth onClick={createCustom} />
              <Button label="Cancel" variant="Secondary" color="Primary" size="Small" onClick={() => setShowCreator(false)} />
            </div>
          </div>
        ) : (
          <div style={{ padding: 'var(--spacing-04) var(--spacing-05)' }}>
            <Button label="+ New Custom Asset" variant="Secondary" color="Primary" size="Small" isFullWidth
              onClick={() => setShowCreator(true)} />
          </div>
        )}
      </div>
    </div>
  )
}
