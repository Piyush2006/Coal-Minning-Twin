// Floating "needs maintenance" badges over static plant machines whose PdM
// severity (from the dashboard's Predictive engine) is Warning/Critical.
// One small chip per flagged machine — nothing on the ground, nothing that can
// overlap. Clicking the chip opens the dashboard's AlertDrawer over the twin.
// Hidden in edit mode.
import { Html } from '@react-three/drei'
import { useSceneStore } from '../store/sceneStore'
import { usePdmAlerts, usePdmUI, TWIN_PDM_MAP, BADGE_Y } from '../lib/pdmBridge'

const SEV = {
  Critical: { ring: '#F04438', bg: 'rgba(240,68,56,0.14)' },
  Warning:  { ring: '#F79009', bg: 'rgba(247,144,9,0.14)' },
}

const WrenchIcon = ({ color }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
)

export function PdmBadgeLayer({ editMode }) {
  const objects = useSceneStore(s => s.objects)
  const alerts = usePdmAlerts()
  const open = usePdmUI(s => s.open)
  if (editMode) return null

  const chips = []
  for (const [tid, did] of Object.entries(TWIN_PDM_MAP)) {
    const o = objects[tid]
    if (!o || o.visible === false) continue
    const a = alerts.get(did)
    if (!a) continue                                     // Normal → no badge
    const sev = SEV[a.severity] || SEV.Warning
    const [x, y, z] = o.position
    chips.push(
      <group key={tid} position={[x, y + (BADGE_Y[tid] ?? 7), z]}>
        {/* no distanceFactor → constant screen-space size (map-pin behaviour):
            readable from any zoom level instead of shrinking with distance */}
        <Html center zIndexRange={[40, 0]} style={{ pointerEvents: 'auto' }}>
          <button
            onClick={() => open(a)}
            title={`${a.id} · ${a.severity} — ${a.diagnosis?.fault || 'needs maintenance'}. Click for details.`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer',
              padding: '6px 12px', borderRadius: 999, border: `1.5px solid ${sev.ring}`,
              background: 'rgba(13,20,40,0.9)', backdropFilter: 'blur(4px)',
              color: '#fff', font: '700 12.5px Inter, system-ui, sans-serif', letterSpacing: 0.2,
              boxShadow: `0 2px 12px ${sev.bg}`, whiteSpace: 'nowrap',
              animation: a.severity === 'Critical' ? 'pdmPulse 1.6s ease-in-out infinite' : 'none',
            }}>
            <WrenchIcon color={sev.ring} />
            {a.id}
          </button>
          <style>{`@keyframes pdmPulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.08) } }`}</style>
        </Html>
      </group>
    )
  }
  return chips.length ? <group>{chips}</group> : null
}
