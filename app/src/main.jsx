import React from 'react'
import ReactDOM from 'react-dom/client'
import '@faclon-labs/design-sdk/styles.css'
import '@xyflow/react/dist/style.css'
import './index.css'
import Root from './Root'

// Dashboard surface behind hash routes (lazy, so nothing loads for normal
// users). The v4 operations dashboard (#/dashboard) is the live one; the v3
// seven-screen surface is retired (kept in the codebase, no longer routed). The
// #/design-system component gallery stays available.
const DV4Dashboard = React.lazy(() => import('./dashboardV4/Dashboard'))
const DV3Gallery = React.lazy(() => import('./dashboardV3/Gallery'))
const DV3_ROUTES = [
  ['#/design-system', DV3Gallery],
  ['#/dashboard', DV4Dashboard], ['#/coal-mining', DV4Dashboard], ['#/coal-processing', DV4Dashboard],
]
function HashRouter() {
  const [hash, setHash] = React.useState(window.location.hash)
  React.useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const match = DV3_ROUTES.find(([prefix]) => hash.startsWith(prefix))
  if (match) {
    const Page = match[1]
    return (
      <React.Suspense fallback={<div style={{ minHeight: '100vh', background: '#EBEEF4' }} />}>
        <Page />
      </React.Suspense>
    )
  }
  return <Root />
}

// ── Recover from STALE MODULES (the "blank screen that only a hard refresh fixed") ──
// On the Vite dev server, when deps are re-optimized the old hashed module URLs go
// 504/404 and the page can white-screen before React mounts. We force a one-time,
// cache-busting reload so it self-heals instead of staying blank. A sessionStorage
// guard prevents reload loops if the failure is genuine.
const RELOAD_KEY = '__stale_module_reload_at'
const isModuleError = (msg = '') =>
  /dynamically imported module|module script failed|Failed to fetch dynamically|Outdated Optimize Dep|error loading dynamically|Loading chunk|Loading CSS chunk/i.test(msg)
function recoverFromStaleModules() {
  try {
    const last = +sessionStorage.getItem(RELOAD_KEY) || 0
    if (Date.now() - last < 10000) return         // already tried in the last 10s — don't loop
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
    const u = new URL(window.location.href)
    u.searchParams.set('_r', String(Date.now()))  // cache-bust so a proxy can't re-serve the stale build
    window.location.replace(u.toString())
  } catch { /* ignore */ }
}
window.addEventListener('vite:preloadError', (e) => { e.preventDefault?.(); recoverFromStaleModules() })
window.addEventListener('error', (e) => { if (isModuleError(e?.message)) recoverFromStaleModules() })
window.addEventListener('unhandledrejection', (e) => { if (isModuleError(e?.reason?.message || String(e?.reason || ''))) recoverFromStaleModules() })

// ── Top-level error boundary — any render crash shows a Reload prompt, never a blank. ──
class RootBoundary extends React.Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#070c18', color: '#c0d4e8', fontFamily: 'system-ui, sans-serif', padding: 32 }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <div style={{ fontSize: 30, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ fontSize: 13, color: '#5a7a9a', lineHeight: 1.5, marginBottom: 18 }}>{String(this.state.error?.message || this.state.error)}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => window.location.reload()} style={{ padding: '9px 18px', border: 'none', borderRadius: 8, background: '#0a84ff', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Reload</button>
              <button onClick={() => { try { localStorage.clear() } catch {} window.location.reload() }} title="Clears saved local data, then reloads"
                style={{ padding: '9px 18px', border: '1px solid rgba(0,200,255,0.3)', borderRadius: 8, background: 'transparent', color: '#c0d4e8', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Reset & reload</button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootBoundary>
      <HashRouter />
    </RootBoundary>
  </React.StrictMode>
)
