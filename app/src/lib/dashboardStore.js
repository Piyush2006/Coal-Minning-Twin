// Which of the two coal-mine views is showing. The project lands on the
// operations DASHBOARD; the 3D twin is one click away. Only meaningful when
// the active scene declares a dashboard (environment/scene `dashboard` block);
// other templates never enter dashboard mode.
import { create } from 'zustand'
import { useSceneStore } from '../store/sceneStore'
import { useTourStore } from '../components/TourPlayer'

export const useDashboard = create((set) => ({
  mode: 'twin',                       // 'dashboard' | 'twin'
  activeTab: 'overview',              // 'overview' | 'monitoring' | 'zones'
  zone: 'pit',                        // selected zone id (Zone Analytics)
  setActiveTab: (activeTab) => set({ activeTab }),
  openZone: (zone) => set({ activeTab: 'zones', zone }),
  setZone: (zone) => set({ zone }),
  compare: false, cmpMetric: 'alerts',
  setCompare: (compare) => set({ compare }),
  inspectorAssetId: null,
  openAssetInspector: (inspectorAssetId) => { console.info('[dashboard] inspect asset', inspectorAssetId); set({ inspectorAssetId }) },
  closeAssetInspector: () => set({ inspectorAssetId: null }),
  setCmpMetric: (cmpMetric) => set({ cmpMetric }),
  enabled: false,                     // scene has a dashboard config
  setEnabled: (enabled, landOnDashboard) => set({ enabled, mode: enabled && landOnDashboard ? 'dashboard' : 'twin' }),
  showDashboard: () => set(s => (s.enabled ? { mode: 'dashboard' } : {})),
  openTwin: () => set({ mode: 'twin' }),
  playTour: () => { set({ mode: 'twin' }); setTimeout(() => useTourStore.getState().start(), 60) },
}))

// Called on project open: land on the dashboard when the scene declares one.
export function syncDashboardForScene() {
  const dash = useSceneStore.getState().dashboard
  const on = !!(dash && dash.enabled !== false && (dash.landing !== false))
  useDashboard.getState().setEnabled(!!dash, on)
}
