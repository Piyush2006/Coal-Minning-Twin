// Hosts the management dashboard's PdM AlertDrawer (Detect → Explain →
// Recommend → Act + the Sensor-data modal) over the 3D twin. Mounted OUTSIDE
// the Canvas. Pulls the dashboard theme CSS so .dash-theme variables + fonts
// exist on the twin route (the dashboard itself is lazy-loaded).
import '../dashboard/theme.css'
import { usePdmUI } from '../lib/pdmBridge'
import { AlertDrawer } from '../dashboard/sections/Predictive'

export function PdmDrawerHost() {
  const a = usePdmUI(s => s.openAlert)
  const close = usePdmUI(s => s.close)
  if (!a) return null
  return <AlertDrawer a={a} onClose={close} />
}
