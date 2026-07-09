import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAIStore } from '../../store/aiStore'
import { exchangeSSOToken, fetchInsights, fetchUserMeta, addInsightResult, fetchInsightResults } from '../../lib/iosense'
import { C, R, glass, SHADOW } from '../../ui/theme'

const field = { width: '100%', padding: '9px 11px', fontFamily: 'inherit', fontSize: 13,
  border: `1px solid ${C.line}`, borderRadius: R.sm, color: C.text, background: C.surface, outline: 'none' }
const label = { fontSize: 12, fontWeight: 600, color: C.text2, marginBottom: 6, display: 'block' }
const tabBtn = (on) => ({ flex: 1, padding: '8px 0', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
  background: on ? C.surface : 'transparent', boxShadow: on ? '0 1px 2px rgba(0,0,0,0.12)' : 'none', color: on ? C.text : C.text2, fontWeight: on ? 600 : 500 })
const primaryBtn = { padding: '9px 16px', border: 'none', borderRadius: R.sm, background: C.accent, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }

// Settings — three independent areas: AI Assistant · IOsense account · UNS live data.
export function SettingsModal({ onClose }) {
  const cfg = useAIStore()
  const [tab, setTab] = useState('ai')
  // Bruce (IOsense AI Agents platform)
  const [bruceUrl, setBruceUrl] = useState(cfg.bruceUrl)
  const [bruceApiKey, setBruceApiKey] = useState(cfg.bruceApiKey)
  const [bruceAgentId, setBruceAgentId] = useState(cfg.bruceAgentId)
  // IOsense account (connect via IOsense token → JWT)
  const [iosToken, setIosToken] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connectErr, setConnectErr] = useState('')
  const [insightId, setInsightId] = useState(cfg.insightId)
  const [insightsList, setInsightsList] = useState(cfg.insights || [])
  const [fetching, setFetching] = useState(false)
  const [fetched, setFetched] = useState(false)
  const [fetchErr, setFetchErr] = useState('')
  const [raw, setRaw] = useState(null)
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState('')
  const [testErr, setTestErr] = useState('')
  // UNS hosts/graph (auth comes from the ONE IOsense connect — same SSO session
  // powers cloud projects, the “/” namespace picker, and the live-data poll)
  const [unsBaseUrl, setUnsBaseUrl] = useState(cfg.unsBaseUrl)
  const [unsGraph, setUnsGraph] = useState(cfg.unsGraph)
  const [unsBrowseBaseUrl, setUnsBrowseBaseUrl] = useState(cfg.unsBrowseBaseUrl)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Auth object for IOsense calls — JWT + base + org id (org header is required).
  const auth = () => ({ jwt: cfg.iosenseJWT, base: cfg.iosenseBaseUrl, org: cfg.iosenseOrg })

  const connect = async () => {
    const t = iosToken.trim()
    if (!t) return
    setConnecting(true); setConnectErr(''); setFetchErr(''); setRaw(null)
    try {
      let jwt = '', org = '', userId = ''
      if (/^(Bearer\s|eyJ)/.test(t)) {            // already a JWT / PAT → use directly
        jwt = t.startsWith('Bearer') ? t : `Bearer ${t}`
      } else {                                     // an SSO token → exchange it
        const r = await exchangeSSOToken(t, cfg.iosenseBaseUrl)
        jwt = r.token; org = r.organisation || ''; userId = r.userId || ''
      }
      // One session for everything: cloud projects, the “/” UNS picker, live values.
      cfg.setConfig({ iosenseJWT: jwt, iosenseOrg: org, iosenseUserId: userId,
        unsBrowseToken: jwt, unsBrowseBaseUrl: (cfg.unsBrowseBaseUrl || '').trim() || 'https://uns-backend-server.iosense.io' })
      // Profile (name/email + a more precise org id from metaData).
      try {
        const m = await fetchUserMeta({ jwt, base: cfg.iosenseBaseUrl, org })
        if (m.orgId) org = m.orgId
        cfg.setConfig({ iosenseName: m.name, iosenseEmail: m.email, iosenseOrgName: m.orgName, ...(m.orgId ? { iosenseOrg: m.orgId } : {}), ...(m.userId ? { iosenseUserId: m.userId } : {}) })
      } catch { /* profile optional */ }
      setIosToken('')
      // Auto-fetch the account's insights right away (uses the fresh jwt/org, not
      // the stale store value). A fetch failure here is shown but keeps us connected.
      setFetching(true)
      try {
        const { rows, raw } = await fetchInsights({ jwt, base: cfg.iosenseBaseUrl, org })
        setInsightsList(rows); setRaw(raw); setFetched(true); cfg.setConfig({ insights: rows })
      } catch (e) { setFetchErr(e.message) } finally { setFetching(false) }
    } catch (e) { setConnectErr(e.message) } finally { setConnecting(false) }
  }

  const disconnect = () => {
    // keep insightId — it's fixed; only the account session is cleared (incl. UNS).
    cfg.setConfig({ iosenseJWT: '', iosenseOrg: '', iosenseUserId: '', iosenseName: '', iosenseEmail: '', iosenseOrgName: '', insights: [], unsBrowseToken: '' })
    setInsightsList([]); setFetched(false); setFetchErr(''); setConnectErr(''); setRaw(null); setTestMsg(''); setTestErr('')
  }

  const doFetchInsights = async () => {
    setFetching(true); setFetchErr(''); setRaw(null)
    try {
      const { rows, raw } = await fetchInsights(auth())
      setInsightsList(rows); setRaw(raw); setFetched(true); cfg.setConfig({ insights: rows })
    } catch (e) { setFetchErr(e.message) } finally { setFetching(false) }
  }

  const doTestStorage = async () => {
    const id = insightId.trim()
    if (!id) return
    setTesting(true); setTestMsg(''); setTestErr('')
    try {
      const ts = new Date().toISOString()
      const created = await addInsightResult(auth(), {
        insightID: id, resultName: `twin-test ${ts}`, result: { hello: 'digital-twin', ts },
        tags: ['digital-twin', '__test__'], userID: cfg.iosenseUserId,
      })
      const { rows } = await fetchInsightResults(auth(), id)
      setTestMsg(`Stored ✓ id ${created?._id || '(unknown)'} · fetched ${rows.length} doc${rows.length === 1 ? '' : 's'}`)
    } catch (e) { setTestErr(e.message) } finally { setTesting(false) }
  }

  const save = () => {
    cfg.setConfig({
      bruceUrl: bruceUrl.trim() || 'https://bruce-staging.iosense.io', bruceApiKey: bruceApiKey.trim(), bruceAgentId: bruceAgentId.trim(),
      insightId,
      unsBaseUrl: unsBaseUrl.trim() || 'https://stagingsv.iosense.io/api', unsGraph: unsGraph.trim() || 'iosense_test_uns',
      unsBrowseBaseUrl: unsBrowseBaseUrl.trim() || 'https://uns-backend-server.iosense.io',
    })
    onClose()
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(20,24,32,0.3)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }} onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(460px, 92vw)', borderRadius: R.lg, ...glass, border: `1px solid ${C.line}`, boxShadow: SHADOW.panel, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 19, fontWeight: 700, color: C.text }}>Settings</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 2, padding: 2, background: 'rgba(120,120,128,0.12)', borderRadius: R.sm, marginBottom: 16 }}>
          <button onClick={() => setTab('ai')} style={tabBtn(tab === 'ai')}>AI Assistant</button>
          <button onClick={() => setTab('iosense')} style={tabBtn(tab === 'iosense')}>IOsense</button>
        </div>

        {tab === 'ai' && <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.5 }}>
            Bruce runs as an agent on the <b style={{ color: C.text }}>IOsense AI Agents platform</b> — its prompt, skills and model live on the agent. No personal model key needed; the fields below are the agent's access details.
          </p>
          <div>
            <span style={label}>Bruce Endpoint</span>
            <input style={field} value={bruceUrl} onChange={(e) => setBruceUrl(e.target.value)} placeholder="https://bruce-staging.iosense.io" />
          </div>
          <div>
            <span style={label}>Agent API Key <span style={{ color: C.text3, fontWeight: 400 }}>(agent-scoped, starts with agv2_)</span></span>
            <input style={field} type="password" value={bruceApiKey} onChange={(e) => setBruceApiKey(e.target.value)} placeholder="agv2_…" autoComplete="off" />
          </div>
          <div>
            <span style={label}>Agent ID <span style={{ color: C.text3, fontWeight: 400 }}>(from the agent's URL on the platform)</span></span>
            <input style={field} value={bruceAgentId} onChange={(e) => setBruceAgentId(e.target.value)} placeholder="e.g. 6a2aec905c99e2cad9969a29" autoComplete="off" />
          </div>
        </div>}

        {tab === 'iosense' && <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.5, margin: 0 }}>
            One connection powers everything: <b style={{ color: C.text }}>cloud projects</b>, the <b style={{ color: C.text }}>“/” UNS namespace picker</b>, and <b style={{ color: C.text }}>live parameter values</b>.
          </p>
          {/* connection status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: R.sm, background: cfg.iosenseJWT ? 'rgba(52,199,89,0.10)' : 'rgba(120,120,128,0.10)', border: `1px solid ${C.line}`, fontSize: 12.5, color: C.text2, lineHeight: 1.5 }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              {cfg.iosenseJWT
                ? <>● <b style={{ color: C.good }}>Connected</b>
                    {(cfg.iosenseName || cfg.iosenseEmail)
                      ? <> · {cfg.iosenseName || cfg.iosenseEmail}{cfg.iosenseName && cfg.iosenseEmail ? <span style={{ color: C.text3 }}> · {cfg.iosenseEmail}</span> : ''}</>
                      : ''}
                    {cfg.iosenseOrgName ? <span style={{ color: C.text3 }}> · {cfg.iosenseOrgName}</span> : ''}</>
                : <>Not connected to IOsense.</>}
            </span>
            {cfg.iosenseJWT && (
              <button onClick={disconnect} title="Disconnect this IOsense account"
                style={{ flexShrink: 0, padding: '4px 10px', border: `1px solid rgba(255,59,48,0.4)`, borderRadius: 6, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: C.bad }}>Disconnect</button>
            )}
          </div>

          {!cfg.iosenseJWT && <>
            <div>
              <span style={label}>IOsense Token <span style={{ color: C.text3, fontWeight: 400 }}>(SSO token from IOsense → Profile, or a PAT)</span></span>
              <input style={field} type="password" value={iosToken} onChange={(e) => setIosToken(e.target.value)}
                placeholder="paste your IOsense token…" autoComplete="off"
                onKeyDown={(e) => { if (e.key === 'Enter') connect() }} />
            </div>
            {connectErr && <p style={{ fontSize: 11.5, color: C.bad }}>{connectErr}</p>}
            <button onClick={connect} disabled={connecting || !iosToken.trim()}
              style={{ ...primaryBtn, opacity: connecting || !iosToken.trim() ? 0.5 : 1 }}>
              {connecting ? 'Connecting…' : 'Connect'}
            </button>
            <p style={{ fontSize: 11, color: C.text3, lineHeight: 1.5 }}>
              Tip: an SSO token is one-time and expires ~60s after you generate it — paste &amp; connect right away. Or open the app with <b style={{ color: C.text2 }}>?token=…</b> in the URL.
              This one connect also powers the <b style={{ color: C.text2 }}>UNS</b> — the “/” namespace picker in parameter fields and the live value polling.
            </p>
          </>}

          {/* connected: projects sync to the fixed insight — nothing to pick */}
          {cfg.iosenseJWT && <div>
            <span style={label}>Cloud projects</span>
            <p style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.5, margin: '2px 0 0' }}>
              Your projects sync to this account's shared IOsense insight. Saving a project offers <b style={{ color: C.text }}>Save to cloud</b>, and the Projects screen lists everything stored there.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
              <button onClick={doTestStorage} disabled={testing}
                style={{ padding: '7px 14px', border: `1px solid ${C.line}`, borderRadius: R.sm, background: 'transparent', cursor: testing ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, color: C.text2, opacity: testing ? 0.5 : 1 }}>
                {testing ? 'Testing…' : 'Test connection'}
              </button>
              {testMsg && <span style={{ fontSize: 11.5, color: C.good, minWidth: 0, flex: 1, wordBreak: 'break-all' }}>{testMsg}</span>}
            </div>
            {testErr && <p style={{ fontSize: 11.5, color: C.bad, margin: '8px 0 0', wordBreak: 'break-all' }}>{testErr}</p>}
          </div>}

          {/* UNS hosts/graph — rarely changed; auth is the account session above */}
          <div>
            <button onClick={() => setShowAdvanced(v => !v)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: C.text2, padding: 0 }}>
              {showAdvanced ? '▾' : '▸'} Advanced · UNS endpoints
            </button>
            {showAdvanced && <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              <div>
                <span style={label}>Namespace browser Base URL</span>
                <input style={field} value={unsBrowseBaseUrl} onChange={(e) => setUnsBrowseBaseUrl(e.target.value)} placeholder="https://uns-backend-server.iosense.io" />
              </div>
              <div>
                <span style={label}>UNS resolve Base URL</span>
                <input style={field} value={unsBaseUrl} onChange={(e) => setUnsBaseUrl(e.target.value)} placeholder="https://stagingsv.iosense.io/api" />
              </div>
              <div>
                <span style={label}>UNS Graph</span>
                <input style={field} value={unsGraph} onChange={(e) => setUnsGraph(e.target.value)} placeholder="iosense_test_uns" />
              </div>
            </div>}
          </div>
        </div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ padding: '9px 16px', border: `1px solid ${C.line}`, borderRadius: R.sm, background: 'transparent', color: C.text2, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>Cancel</button>
          <button onClick={save} style={primaryBtn}>Save</button>
        </div>
      </motion.div>
    </motion.div>
  )
}
