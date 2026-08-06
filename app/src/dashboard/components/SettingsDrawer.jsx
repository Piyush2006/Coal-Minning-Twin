// Settings / Inputs — the user-configurable values that cannot come from IoT.
// Exactly 8 inputs across Production & Targets, Cost, and Efficiency Targets.
// Operating hours, shift timings and sensor thresholds are NOT user inputs — they
// live as predefined internal config (see settingsDefaults.js) so utilisation,
// the shift-wise toggle and predictive-maintenance alerts keep working.
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@faclon-labs/design-sdk/Drawer'
import { Button } from '@faclon-labs/design-sdk/Button'
import { TextInput } from '@faclon-labs/design-sdk/TextInput'
import { Badge } from '@faclon-labs/design-sdk/Badge'
import { Divider } from '@faclon-labs/design-sdk/Divider'
import { useDash } from '../store'
import { CURRENCY } from '../data/taxonomy'

function NumField({ label, value, unit, onChange }) {
  return (
    <TextInput label={label} type="number" value={String(value)} suffix={unit}
      onChange={({ value }) => { if (value === '') return; const n = Number(value); if (!Number.isNaN(n)) onChange(n) }} />
  )
}
const Group = ({ title, children, cols = 2 }) => (
  <div style={{ display: 'grid', gap: 12 }}>
    <div className="BodySmallSemibold" style={{ color: 'var(--text-gray-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</div>
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>{children}</div>
  </div>
)

export function SettingsDrawer({ isOpen, onClose }) {
  const { settings, updateSettings, resetSettings } = useDash()
  const s = settings
  const set = (key) => (v) => updateSettings({ [key]: v })

  return (
    <Drawer isOpen={isOpen} onDismiss={onClose} accessibilityLabel="Dashboard settings and inputs">
      <DrawerHeader title="Settings · Inputs" subtitle="Values you configure — not measured by IoT" />
      <DrawerBody>
        <div style={{ display: 'grid', gap: 20, paddingBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 'var(--global-border-radius-large)', background: 'var(--background-info-secondary, var(--background-surface-subtle))' }}>
            <Badge color="Information" emphasis="Subtle" size="Small">Your input</Badge>
            <span className="BodySmallRegular" style={{ color: 'var(--text-gray-secondary)' }}>These set the plan and targets every KPI is compared against.</span>
          </div>

          <Group title="Production & Targets">
            <NumField label="Planned Production" unit="T/day" value={s.plannedProductionPerDay} onChange={set('plannedProductionPerDay')} />
            <NumField label="Target Throughput" unit="T/hr" value={s.targetThroughput} onChange={set('targetThroughput')} />
            <NumField label="Target Coal Yield / Recovery" unit="%" value={s.targetCoalYield} onChange={set('targetCoalYield')} />
          </Group>
          <Divider />

          <Group title="Cost">
            <NumField label="Planned Cost / Ton" unit={`${CURRENCY}/T`} value={s.plannedCostPerTon} onChange={set('plannedCostPerTon')} />
            <NumField label="Electricity Cost / kWh" unit={`${CURRENCY}/kWh`} value={s.electricityCostPerKwh} onChange={set('electricityCostPerKwh')} />
            <NumField label="Fuel / Diesel Cost / litre" unit={`${CURRENCY}/L`} value={s.fuelCostPerLitre} onChange={set('fuelCostPerLitre')} />
          </Group>
          <Divider />

          <Group title="Efficiency Targets">
            <NumField label="Target Energy / Ton" unit="kWh/T" value={s.targetEnergyPerTon} onChange={set('targetEnergyPerTon')} />
            <NumField label="Target Fuel / Ton" unit="L/T" value={s.targetFuelPerTon} onChange={set('targetFuelPerTon')} />
          </Group>
        </div>
      </DrawerBody>
      <DrawerFooter>
        <Button variant="Gray" color="Primary" size="Medium" onClick={resetSettings}>Reset to defaults</Button>
        <Button variant="Primary" color="Primary" size="Medium" onClick={onClose}>Done</Button>
      </DrawerFooter>
    </Drawer>
  )
}
