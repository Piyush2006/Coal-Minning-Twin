// Section 6 · Safety — "Are operations safe and compliant?" Safety Compliance %
// = (Checks − Violations) / Checks × 100, with a compliance trend and drill-down
// by PPE / Restricted Area / Vehicle Safety / Other.
import { useMemo, useState } from 'react'
import { LineChart } from '@faclon-labs/design-sdk/LineChart'
import { HorizontalGroupBarChart } from '@faclon-labs/design-sdk/HorizontalGroupBarChart'
import { Button } from '@faclon-labs/design-sdk/Button'
import { Badge } from '@faclon-labs/design-sdk/Badge'
import { useDash } from '../store'
import { buildSafety, complianceStatus } from '../calc/safety'
import { NUM, STATUS, fmt } from '../calc/format'
import { fmtStamp } from '../data/time'
import { Panel } from '../components/primitives'

const CHIPS = [{ id: 'all', name: 'All' }, { id: 'PPE', name: 'PPE' }, { id: 'Restricted Area', name: 'Restricted Area' }, { id: 'Vehicle Safety', name: 'Vehicle Safety' }, { id: 'Other', name: 'Other' }]

export function Safety() {
  const { range, mineId, areaId, equipTypeId, shiftMode, settings } = useDash()
  const sf = useMemo(() => buildSafety({ range, mineId, areaId, equipTypeId, settings }), [range, mineId, areaId, equipTypeId, settings])
  const [cat, setCat] = useState('all')

  const cur = sf.totalsByKey[cat] || sf.total
  const st = STATUS[complianceStatus(cur.compliancePct)]

  return (
    <div style={{ display: 'grid', gap: 18 }}>

      {/* drill-down by category */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {CHIPS.map(c => (
          <Button key={c.id} size="XSmall" variant={cat === c.id ? 'Secondary' : 'Gray'} onClick={() => setCat(c.id)}>{c.name}</Button>
        ))}
      </div>

      {/* compliance headline */}
      <Panel>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 2fr', gap: 28, alignItems: 'center' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <span className="BodySmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>Safety Compliance{cat !== 'all' ? ` · ${cat}` : ''}</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span className="DisplayMediumSemibold" style={{ color: st.text, ...NUM }}>{fmt(cur.compliancePct, 1)}%</span>
              <Badge color={st.badge} emphasis="Subtle" size="Medium">{st.label}</Badge>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap' }}>
            <HeroStat label="Total Checks / Observations" value={fmt(cur.checks)} />
            <HeroStat label="Violations" value={fmt(cur.violations)} color={cur.violations ? 'var(--text-error-default)' : 'var(--text-positive-default)'} />
            {shiftMode && sf.shifts.map(s => (
              <HeroStat key={s.name} label={`${s.name} compliance`} value={`${fmt(s.compliancePct, 1)}%`} sub={`${fmt(s.violations)} viol.`} />
            ))}
          </div>
        </div>
      </Panel>

      {/* compliance trend + violations by category */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 18 }}>
        <div style={{ height: 320 }}>
          <LineChart
            title={`Safety Compliance Trend${cat !== 'all' ? ` · ${cat}` : ''}`}
            duration={`${fmtStamp(range.start)} → ${fmtStamp(range.end)}`}
            categories={sf.categories}
            series={[{ name: 'Compliance %', data: sf.trend.compliance[cat], color: 'var(--background-positive-default)' }]}
            showLegend={false}
            smooth
            showMarkers={sf.categories.length <= 31}
            yAxisUnit=" %"
            xAxisTitle="Day"
            yAxisTitle="Compliance %"
          />
        </div>
        <div style={{ height: 320 }}>
          <HorizontalGroupBarChart
            title="Violations by Category"
            duration="Count over the selected period, largest first"
            categories={sf.byCategory.map(c => c.cat)}
            series={[{ name: 'Violations', data: sf.byCategory.map(c => c.violations), color: 'var(--background-error-default)' }]}
          />
        </div>
      </div>
    </div>
  )
}

const HeroStat = ({ label, value, color, sub }) => (
  <div style={{ display: 'grid', gap: 3 }}>
    <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)' }}>{label}</span>
    <span className="HeadingLargeSemibold" style={{ color: color || 'var(--text-gray-primary)', ...NUM }}>{value}</span>
    {sub && <span className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', ...NUM }}>{sub}</span>}
  </div>
)
