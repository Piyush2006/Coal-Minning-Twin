import { useSceneStore } from '../store/sceneStore'
import { getParameterSchema } from '../lib/parameterSchemas'

const OPERATORS = ['>', '>=', '<', '<=', '==', '!=']

const selectStyle = {
  flex: 1, minWidth: 0, padding: '4px 6px', fontFamily: 'inherit', fontSize: 12,
  border: '1px solid var(--border-gray-default)', borderRadius: 'var(--global-border-radius-small)',
  color: 'var(--text-default-primary)', background: '#fff',
}
const segBtn = (active) => ({
  flex: 1, padding: '3px 0',
  background: active ? 'var(--background-brand-secondary)' : 'transparent',
  border: active ? '1px solid var(--border-brand-default)' : '1px solid var(--border-gray-default)',
  borderRadius: 'var(--global-border-radius-medium)',
  color: active ? 'var(--text-brand-default)' : 'var(--text-default-secondary)',
  cursor: 'pointer', fontFamily: 'inherit',
})

// One visual rule. Native selects keep it reliable and the keyboard guard
// already treats SELECT/INPUT as "typing" so scene shortcuts won't fire here.
export function RuleEditor({ obj, rule }) {
  const { updateRule, removeRule, objects, customAssetTypes } = useSceneStore()
  const set = (changes) => updateRule(obj.id, rule.id, changes)

  const params      = getParameterSchema(obj.type, customAssetTypes)
  const otherAssets = Object.values(objects).filter(o => o.id !== obj.id)
  const refObj      = rule.refAssetId ? objects[rule.refAssetId] : null
  const refParams   = refObj ? getParameterSchema(refObj.type, customAssetTypes) : []

  return (
    <div style={{
      border: '1px solid var(--border-gray-default)', borderRadius: 'var(--global-border-radius-medium)',
      padding: 'var(--spacing-03)', marginBottom: 'var(--spacing-03)',
      display: 'flex', flexDirection: 'column', gap: 'var(--spacing-02)',
      opacity: rule.enabled ? 1 : 0.55,
    }}>
      {/* header: enable · color · remove */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-02)' }}>
        <button onClick={() => set({ enabled: !rule.enabled })} style={segBtn(rule.enabled)}>
          <span className="BodyXSmallRegular">{rule.enabled ? 'On' : 'Off'}</span>
        </button>
        <input type="color" value={rule.color} onChange={(e) => set({ color: e.target.value })}
          title="Glow colour"
          style={{ width: 30, height: 24, border: '1px solid var(--border-gray-default)',
            borderRadius: 'var(--global-border-radius-small)', background: 'none', cursor: 'pointer', padding: 0 }} />
        <button onClick={() => removeRule(obj.id, rule.id)} title="Remove rule"
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-default-tertiary)', fontSize: 16, lineHeight: 1 }}>×</button>
      </div>

      {/* parameter + operator */}
      <div style={{ display: 'flex', gap: 'var(--spacing-02)' }}>
        <select value={rule.parameter} onChange={(e) => set({ parameter: e.target.value })} style={selectStyle}>
          {params.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <select value={rule.operator} onChange={(e) => set({ operator: e.target.value })}
          style={{ ...selectStyle, flex: '0 0 56px' }}>
          {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
        </select>
      </div>

      {/* compare against constant or another asset */}
      <div style={{ display: 'flex', gap: 'var(--spacing-02)' }}>
        <button onClick={() => set({ compareMode: 'constant' })} style={segBtn(rule.compareMode === 'constant')}>
          <span className="BodyXSmallRegular">Value</span>
        </button>
        <button onClick={() => set({ compareMode: 'asset' })} style={segBtn(rule.compareMode === 'asset')}>
          <span className="BodyXSmallRegular">Asset</span>
        </button>
      </div>

      {rule.compareMode === 'constant' ? (
        <input type="number" value={rule.value}
          onChange={(e) => set({ value: e.target.value === '' ? '' : Number(e.target.value) })}
          style={{ ...selectStyle, flex: 'none', width: '100%' }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-02)' }}>
          <select value={rule.refAssetId ?? ''}
            onChange={(e) => {
              const id = e.target.value || null
              const rp = id ? getParameterSchema(objects[id].type, customAssetTypes)[0]?.key ?? '' : ''
              set({ refAssetId: id, refParameter: rp })
            }}
            style={{ ...selectStyle, flex: 'none', width: '100%' }}>
            <option value="">Select asset…</option>
            {otherAssets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          {refObj && (
            <select value={rule.refParameter} onChange={(e) => set({ refParameter: e.target.value })}
              style={{ ...selectStyle, flex: 'none', width: '100%' }}>
              {refParams.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          )}
        </div>
      )}
    </div>
  )
}
