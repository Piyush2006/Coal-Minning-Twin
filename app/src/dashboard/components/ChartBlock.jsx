// Renders a chart spec that Bruce emits in a ```chart fenced JSON block, using
// the same design-sdk charts the dashboard uses. Spec shape:
//   { type: 'line'|'area'|'column'|'bar'|'pie', title, categories:[…],
//     series:[{name,data:[…]}], unit?, xTitle?, yTitle? }
// Bad/partial specs degrade to a small note instead of throwing.
import { LineChart } from '@faclon-labs/design-sdk/LineChart'
import { ColumnChart } from '@faclon-labs/design-sdk/ColumnChart'
import { HorizontalGroupBarChart } from '@faclon-labs/design-sdk/HorizontalGroupBarChart'

const COLORS = [
  'var(--background-info-default)', 'var(--background-positive-default)', 'var(--background-warning-default)',
  'var(--background-brand-default)', 'var(--background-error-default)', 'var(--text-gray-tertiary)',
]
const Box = ({ children }) => <div style={{ height: 250, width: '100%', margin: '6px 0' }}>{children}</div>
const Note = ({ children }) => <div className="BodyXSmallRegular" style={{ color: 'var(--text-gray-tertiary)', padding: '6px 0' }}>{children}</div>

export function ChartBlock({ spec }) {
  if (!spec || !Array.isArray(spec.series) || !spec.series.length) return <Note>◱ (chart data unavailable)</Note>
  const series = spec.series.map((s, i) => ({
    name: s.name || `Series ${i + 1}`,
    data: (Array.isArray(s.data) ? s.data : []).map(v => (typeof v === 'number' ? v : Number(v))),
    color: COLORS[i % COLORS.length],
  }))
  const categories = Array.isArray(spec.categories) ? spec.categories.map(String) : []
  const type = String(spec.type || 'line').toLowerCase()
  const unit = spec.unit ? ` ${spec.unit}` : undefined
  const common = { title: spec.title || '', categories, series, showLegend: series.length > 1 }

  try {
    if (type === 'bar' || type === 'hbar' || type === 'pie') {
      // horizontal bars (pie falls back to a ranked bar — no external pie dep needed)
      return <Box><HorizontalGroupBarChart title={common.title} categories={categories} series={series} /></Box>
    }
    if (type === 'column') {
      return <Box><ColumnChart {...common} yAxisUnit={unit} xAxisTitle={spec.xTitle} yAxisTitle={spec.yTitle} /></Box>
    }
    // line / area / spline / default
    return <Box><LineChart {...common} smooth showMarkers={categories.length <= 31} yAxisUnit={unit} xAxisTitle={spec.xTitle} yAxisTitle={spec.yTitle} /></Box>
  } catch {
    return <Note>◱ (could not render chart)</Note>
  }
}
