import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSceneStore } from '../../store/sceneStore'
import { useProjectStore } from '../../store/projectStore'
import { useAIStore, aiConfigured } from '../../store/aiStore'
import { chat } from '../../lib/ai/client'
import { buildBruceMessage, extractJSON } from '../../lib/ai/prompt'
import { validateSpec } from '../../lib/twinSpec'
import { validateComponentSpec } from '../../lib/componentSpec'
import { useStudioStore } from '../../store/studioStore'
import { applyCommands } from '../../lib/ai/execute'
import { fetchWorkspaceList, runQueries, formatUnsContext } from '../../lib/ai/unsContext'
import { autobindScene } from '../../lib/ai/unsAutobind'
import { lintComponentSpec, formatDefects } from '../../lib/componentLint'
import { lintScene } from '../../lib/sceneLint'
import { confirmDialog } from '../dialogs'
import { SettingsModal } from './SettingsModal'
import { C, R, glass, SHADOW } from '../../ui/theme'

const COL = { width: '100%', height: '100%', flexShrink: 0, ...glass, borderLeft: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column' }

const SCENE_SUGGESTIONS = [
  'Build a 2-line bottling plant',
  'Add a third line of 4 reduction pots and bus-bar them',
  'Create a motor-pump skid and place it',
  'Stage an upset: a few pots in anode effect and a low silo',
]
const COMPONENT_SUGGESTIONS = [
  'Add a cooling jacket around the body',
  'Add 6 bolts around the top flange',
  'Make the body 20% taller',
  'Give each nozzle a flow-rate parameter',
]

// The AI assistant. `surface` decides what Bruce acts on: the whole scene
// (shopfloor) or the ONE component open in the Studio. Same per-project thread.
export function ChatPanel({ surface = 'scene' }) {
  const isComponent = surface === 'component'
  const [settings, setSettings] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyFor, setBusyFor] = useState(0)   // seconds since work started (proof of life)
  const scrollRef = useRef()
  const cfg = useAIStore()

  // Detailed authoring turns legitimately stream for minutes — tick a visible
  // elapsed counter so "Thinking…" never reads as frozen.
  useEffect(() => {
    if (!busy) { setBusyFor(0); return }
    const t0 = Date.now()
    const iv = setInterval(() => setBusyFor(Math.floor((Date.now() - t0) / 1000)), 1000)
    return () => clearInterval(iv)
  }, [busy])
  const configured = useAIStore(aiConfigured)
  const projectName = useProjectStore(s => (s.activeId ? s.projects[s.activeId]?.name : null) || 'Project')
  const projectId = useProjectStore(s => s.activeId)
  const draftLabel = useStudioStore(s => s.draft?.label)
  // Chat is per-project (isolated) and persisted — survives navigation/reload.
  const messages = useProjectStore(s => (s.activeId ? s.projects[s.activeId]?.chat : null) ?? [])
  const push = useProjectStore(s => s.addChatMessage)
  const clearChat = useProjectStore(s => s.clearChat)
  const SUGGESTIONS = isComponent ? COMPONENT_SUGGESTIONS : SCENE_SUGGESTIONS

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [messages, busy])

  // "Describe to Bruce" (from the Components modal) drops a starter prompt here.
  useEffect(() => {
    if (cfg.chatSeed) { setInput(cfg.chatSeed); cfg.setConfig({ chatSeed: '' }) }
  }, [cfg.chatSeed])

  const send = async (text) => {
    const q = (text ?? input).trim()
    if (!q || busy) return
    if (!configured) { push('assistant', 'Connect Bruce first — set the agent endpoint, API key and agent ID (gear icon, top-right).'); setSettings(true); return }
    setInput('')
    push('user', q)
    setBusy(true)
    try {
      const { objects, groups } = useSceneStore.getState()
      // Live UNS context (workspace list) so Bruce can bind/build from real tags.
      // Auth = the platform session (same SSO login that powers cloud projects).
      const unsToken = cfg.iosenseJWT || cfg.unsBrowseToken
      const unsAuth = { token: unsToken, base: cfg.unsBrowseBaseUrl }
      let unsText = ''
      if (!isComponent && unsToken) {
        const workspaces = await fetchWorkspaceList(unsAuth)
        unsText = formatUnsContext({ workspaces })
      }
      // One platform session per project — Bruce keeps the conversation history
      // server-side; we send only the context blocks + the new message each turn.
      const bruceAuth = { endpoint: cfg.bruceUrl, agentId: cfg.bruceAgentId, apiKey: cfg.bruceApiKey }
      const bruceCall = async (message, { oneShot = false } = {}) => {
        const sid = oneShot ? null : (useAIStore.getState().bruceSessions?.[projectId] || null)
        try {
          const r = await chat({ ...bruceAuth, message, sessionId: sid })
          if (!oneShot && r.sessionId && r.sessionId !== sid) cfg.setBruceSession(projectId, r.sessionId)
          return r.text
        } catch (e) {
          // A continued platform session can go STALE (created under an older
          // agent config, or over-grown) and then every follow-up turn comes
          // back empty. Self-heal: drop the session and retry ONCE fresh.
          if (!sid || !/empty reply/i.test(e.message)) throw e
          push('assistant', '🔄 Platform session went stale — starting a fresh one…')
          cfg.setBruceSession(projectId, null)
          const r = await chat({ ...bruceAuth, message, sessionId: null })
          if (!oneShot && r.sessionId) cfg.setBruceSession(projectId, r.sessionId)
          return r.text
        }
      }
      const ctx = isComponent
        ? { surface: 'component', component: useStudioStore.getState().draft }
        : { surface: 'scene', objects, groups, customAssetTypes: useSceneStore.getState().customAssetTypes, uns: unsText }
      const ask = async (followUp) => extractJSON(await bruceCall(followUp ?? buildBruceMessage(ctx, q)))

      // ── quality-loop helpers (plan pipeline + component mode) ──
      // Focused one-shot sub-requests on their own surface.
      const askJSON = async (subCtx, userText) => {
        const call = () => bruceCall(buildBruceMessage(subCtx, userText), { oneShot: true })
        try { return extractJSON(await call()) }
        catch { return extractJSON(await call()) }   // one retry on parse failure
      }
      const createCtx = { surface: 'create' }
      // adopt a candidate spec only if it's valid, no buggier, and not a stub
      const betterSpec = (cur, cand) => {
        if (!cand?.ok) return cur
        if (lintComponentSpec(cand.spec).errors.length > lintComponentSpec(cur.spec).errors.length) return cur
        if ((cand.spec.parts || []).length < (cur.spec.parts || []).length * 0.6) return cur
        return cand
      }
      // the app talks back: physical lint report → one corrective authoring round
      const lintAndFix = async (r, brief, label) => {
        const { defects, errors } = lintComponentSpec(r.spec)
        if (!errors.length && !defects.some(d => d.code === 'thin')) return r
        push('assistant', `🧪 ${label}: ${errors.length ? `${errors.length} physical issue${errors.length === 1 ? '' : 's'} found` : 'too basic'} — asking Bruce to fix…`)
        try {
          const r2 = validateComponentSpec((await askJSON(createCtx, `${brief}\n\nLINT REPORT on your previous spec — fix ALL of these and return the FULL corrected Component Spec (same envelope):\n${formatDefects(defects)}`)).spec ?? {})
          return betterSpec(r, r2)
        } catch { return r }
      }

      let env
      try { env = await ask() }
      catch (_) {
        // one corrective retry — most failures are JSONC comments / stray prose
        env = await ask('IMPORTANT: your previous reply could not be parsed. Reply again with the SAME envelope as STRICT, MINIFIED JSON ONLY — one line, double quotes, no comments, no trailing commas, no code fences, no prose.')
      }

      // UNS query loop — Bruce requests tag searches; the app runs them and
      // re-invokes with the real paths, then Bruce binds/builds. (≤2 rounds.)
      let unsRounds = 0
      while (env?.mode === 'uns_query' && unsRounds < 2 && unsToken) {
        unsRounds++
        push('assistant', env.message || 'Looking up UNS tags…')
        const qr = await runQueries(unsAuth, env.queries || [])
        const block = qr.map(r => {
          const head = `[${r.workspace}] q="${r.q}"${r.error ? ` — error: ${r.error}` : ''}`
          const rows = (r.matches || []).slice(0, 40).map(m => `  ${m.type} · ${m.name} → ${m.path}`)
          return [head, ...rows, (!r.error && !(r.matches || []).length) ? '  (no matches)' : ''].filter(Boolean).join('\n')
        }).join('\n')
        env = await ask(`=== UNS SEARCH RESULTS (real paths — use ONLY these) ===\n${block}\n\nNow act on the user's request with these paths (bind via bind_uns / paramMeta / unsRef, or build).`)
      }

      const pushClarify = () => {
        const qs = Array.isArray(env.questions) ? env.questions : []
        const lines = qs.map((q, i) => {
          const text = typeof q === 'string' ? q : (q?.question || '')
          const opts = Array.isArray(q?.options) && q.options.length ? `  (${q.options.join(' · ')})` : ''
          const def = q?.default ? `  — default: ${q.default}` : ''
          return `${i + 1}. ${text}${opts}${def}`
        }).filter(Boolean)
        push('assistant', `${env.message || 'A couple of quick questions first:'}\n${lines.join('\n')}\n\nAnswer those, or just say “use sensible defaults”.`)
      }

      if (isComponent) {
        // ── Studio: edit ONLY the open component ──
        if (env.mode === 'edit_component') {
          const cmds = env.commands ?? []
          if (!cmds.length) { push('assistant', env.message || "That's a plant change — go back to the scene to do it."); return }
          const { applied, errors } = useStudioStore.getState().applyComponentEdit(cmds)
          push('assistant', `${env.message || 'Updated the component.'} — ${applied} change${applied === 1 ? '' : 's'}${errors.length ? `; ${errors.length} failed (${errors[0]})` : ''}`)
        } else if (env.mode === 'clarify') {
          pushClarify()
        } else {
          push('assistant', env.message || "I'm focused on this component here. Go back to the scene to change the plant.")
        }
      } else if (env.mode === 'plan') {
        // ── Build pipeline: plan → author each NEW component (richly) → assemble ──
        // Each sub-step is its OWN one-shot request on a focused SURFACE (create /
        // assemble), NOT the scene surface — otherwise "always plan" + the original
        // build message push Bruce back to planning and the component never authors.
        const manifest = Array.isArray(env.components) ? env.components : []
        push('assistant', `${env.message || 'Here’s the build plan.'}${env.summary ? `\n\n${env.summary}` : ''}`)
        const newOnes = manifest.filter(c => c && c.source === 'new')
        const created = {}   // key → { id, spec, label }
        for (let i = 0; i < newOnes.length; i++) {
          const c = newOnes[i]
          push('assistant', `🔧 Creating component ${i + 1}/${newOnes.length}: ${c.label}…`)
          try {
            const brief = `Author the component "${c.label}". Brief: ${c.brief || c.label}`
            let r = validateComponentSpec((await askJSON(createCtx, brief)).spec ?? {})
            if (!r.ok) throw new Error(r.errors[0] || 'invalid spec')
            r = await lintAndFix(r, brief, c.label)   // app-side physics check → one corrective round
            const id = useSceneStore.getState().addCustomAssetType(r.spec)
            created[c.key] = { id, spec: { ...r.spec, id }, label: r.spec.label || c.label }
            push('assistant', `✓ ${created[c.key].label} (${(r.spec.parts || []).length} parts)`)
          } catch (e) {
            const id = useSceneStore.getState().addCustomAssetType({ label: c.label, primitive: 'box', layer: 'equipment' })
            created[c.key] = { id, spec: useSceneStore.getState().customAssetTypes[id], label: c.label, fallback: true }
            push('assistant', `⚠️ ${c.label}: placeholder used (${e.message}).`)
          }
        }
        push('assistant', '🏗️ Assembling the scene…')
        // List each new component with its TYPE id + PORT ids so the model can connect them.
        const idLines = newOnes.map(c => {
          const sp = created[c.key]?.spec
          const ports = (sp?.ports || []).map(p => `${p.id}(${p.type},${p.direction})`).join(', ') || 'NO PORTS'
          return `"${c.label}" → type "${created[c.key]?.id}" · ports: ${ports}`
        }).join('\n')
        const assembleCtx = { surface: 'assemble', customAssetTypes: useSceneStore.getState().customAssetTypes, uns: unsText }
        const assembleMsg = `Build the full scene for: "${q}".\nArchitecture: ${env.summary || ''}\n\nNew equipment (use these EXACT type ids; connect via the listed ports, out → in):\n${idLines || '(none)'}\n\nFor other assets use catalog types. CONNECT every adjacent machine along each line (a connection on the upstream asset, sourcePort out → targetPort in) so conveyors/pipes are drawn — the line must be a connected, moving chain. Reference every component by id — never redefine or placeholder. Group into an ISA-95/UNS hierarchy with realistic parameters + per-line kpis.`
        // the assemble reply omits the rich authored specs — re-merge them EVERY round
        const mergeCreated = (g) => {
          const spec = g?.spec || {}
          spec.customAssetTypes = { ...(spec.customAssetTypes || {}) }
          for (const k in created) spec.customAssetTypes[created[k].id] = created[k].spec   // ensure known + carry rich specs
          return spec
        }
        let gEnv = await askJSON(assembleCtx, assembleMsg)
        let res = validateSpec(mergeCreated(gEnv))
        if (!res.ok) { push('assistant', `⚠️ Components created, but the scene didn't validate: ${res.errors[0]}`); return }
        // layout lint (clipping / stacked / unconnected) → one corrective assemble round
        const sl = lintScene(res.scene, useSceneStore.getState().customAssetTypes)
        if (sl.defects.length) {
          push('assistant', `🧪 Layout check: ${sl.defects.length} issue${sl.defects.length === 1 ? '' : 's'} — asking Bruce to fix…`)
          try {
            const gEnv2 = await askJSON(assembleCtx, `${assembleMsg}\n\nYOUR PREVIOUS SCENE had these layout defects — fix ALL of them and return the FULL corrected Twin Spec:\n${formatDefects(sl.defects)}`)
            const res2 = validateSpec(mergeCreated(gEnv2))
            if (res2.ok && lintScene(res2.scene, useSceneStore.getState().customAssetTypes).defects.length <= sl.defects.length) { gEnv = gEnv2; res = res2 }
          } catch { /* keep the first assembly */ }
        }
        if (unsToken) { try { const n = await autobindScene(res.scene, unsAuth); if (n) push('assistant', `🔗 Auto-bound ${n} parameter${n === 1 ? '' : 's'} to live UNS tags.`) } catch { /* best-effort */ } }
        const existing0 = Object.keys(useSceneStore.getState().objects).length
        if (existing0 > 0 && !(await confirmDialog({ title: 'Replace scene?', body: 'Replace the current scene with the generated one? The new components stay in your library either way.', confirmLabel: 'Replace' }))) { push('assistant', 'Created the components; kept your current scene.'); return }
        useSceneStore.getState().loadScene(res.scene)
        useProjectStore.getState().markDirty()
        const nNew = Object.keys(created).length
        push('assistant', `${gEnv.message || 'Built the scene.'} — ${res.stats.assets} assets, ${res.stats.groups} groups, ${nNew} new component${nNew === 1 ? '' : 's'}.`)
      } else if (env.mode === 'generate') {
        const res = validateSpec(env.spec ?? {})
        if (!res.ok) { push('assistant', `⚠️ ${env.message || 'Generated a scene'} — but it didn't validate: ${res.errors[0]}`); return }
        if (unsToken) { try { const n = await autobindScene(res.scene, unsAuth); if (n) push('assistant', `🔗 Auto-bound ${n} parameter${n === 1 ? '' : 's'} to live UNS tags.`) } catch { /* best-effort */ } }
        const existing = Object.keys(useSceneStore.getState().objects).length
        if (existing > 0 && !(await confirmDialog({ title: 'Replace scene?', body: 'Replace the current scene with the generated one?', confirmLabel: 'Replace' }))) { push('assistant', 'Okay, kept your current scene.'); return }
        useSceneStore.getState().loadScene(res.scene)
        useProjectStore.getState().markDirty()   // generated scene is unsaved
        push('assistant', `${env.message || 'Generated the scene.'} (${res.stats.assets} assets, ${res.stats.groups} groups${res.warnings.length ? `; ${res.warnings.length} note(s)` : ''})`)
      } else if (env.mode === 'manipulate') {
        const { applied, errors } = applyCommands(env.commands ?? [])
        if (applied > 0) useProjectStore.getState().markDirty()   // edits are unsaved
        push('assistant', `${env.message || 'Done.'} — applied ${applied} change${applied === 1 ? '' : 's'}${errors.length ? `; ${errors.length} failed (${errors[0]})` : ''}`)
      } else if (env.mode === 'clarify') {
        pushClarify()
      } else if (env.mode === 'component') {
        let r = validateComponentSpec(env.spec ?? {})
        if (!r.ok) { push('assistant', `⚠️ ${env.message || 'Designed a component'} — but it didn't validate: ${r.errors[0]}`); return }
        r = await lintAndFix(r, `Author the component "${r.spec.label || 'component'}". Brief: ${q}`, r.spec.label || 'component')
        const scene = useSceneStore.getState()
        const id = scene.addCustomAssetType(r.spec)
        const oid = scene.addObject(id, [(Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8], r.spec.layer || 'equipment')
        scene.selectObject?.(oid)
        useProjectStore.getState().markDirty()
        push('assistant', `${env.message || 'Created the component.'} — placed “${r.spec.label}” in the scene. Open it in the Component Studio to refine it.`)
      } else {
        push('assistant', env.message || "I couldn't act on that. Try rephrasing.")
      }
    } catch (err) {
      push('assistant', `⚠️ ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={COL}>
      <AnimatePresence>{settings && <SettingsModal onClose={() => setSettings(false)} />}</AnimatePresence>

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 14px', borderBottom: `1px solid ${C.line}` }}>
        <img src="/bruce-ai-logo.svg" alt="Bruce AI" width={22} height={22} style={{ borderRadius: 6, display: 'block' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, lineHeight: 1.1 }}>Bruce AI</div>
          <div style={{ fontSize: 10.5, color: isComponent ? C.accent : C.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isComponent ? `Component · ${draftLabel || 'editing'}` : `Scene · ${projectName}`}
          </div>
        </div>
        <button onClick={async () => { if (messages.length <= 1 || await confirmDialog({ title: 'Clear conversation?', body: 'This clears the chat and starts a fresh Bruce session for this project.', confirmLabel: 'Clear', danger: true })) { clearChat(); if (projectId) cfg.setBruceSession(projectId, null) } }} title="Clear chat"
          style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: C.text2, fontSize: 14 }}>↺</button>
        <button onClick={() => setSettings(true)} title="AI settings"
          style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: C.text2, fontSize: 15 }}>⚙</button>
      </div>

      {/* messages */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%',
            padding: '8px 11px', borderRadius: 12, fontSize: 13, lineHeight: 1.45,
            background: m.role === 'user' ? C.accent : 'rgba(120,120,128,0.12)', color: m.role === 'user' ? '#fff' : C.text }}>{m.text}</div>
        ))}
        {busy && (
          <div style={{ alignSelf: 'flex-start', fontSize: 12.5, color: C.text3, padding: '4px 6px' }}>
            Thinking…{busyFor >= 5 ? ` ${Math.floor(busyFor / 60) ? `${Math.floor(busyFor / 60)}m ` : ''}${busyFor % 60}s` : ''}
            {busyFor >= 90 ? ' — detailed components stream for a few minutes; still working' : ''}
          </div>
        )}
        {messages.length <= 1 && !busy && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => send(s)} style={{ fontSize: 12, color: C.accent, background: C.accentSoft, border: 'none',
                borderRadius: R.pill, padding: '5px 11px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>{s}</button>
            ))}
          </div>
        )}
      </div>

      {/* input */}
      <div style={{ padding: 12, borderTop: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2}
          placeholder={!configured ? 'Connect Bruce (⚙) to begin' : isComponent ? 'Ask to change this component…' : 'Ask to build or change the scene…'}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          style={{ width: '100%', resize: 'none', padding: '9px 11px', border: `1px solid ${C.line}`, borderRadius: R.sm,
            fontFamily: 'inherit', fontSize: 13, color: C.text, background: C.surface, outline: 'none' }} />
        <button onClick={() => send()} disabled={busy} style={{ height: 34, border: 'none', borderRadius: R.sm,
          background: busy ? 'rgba(120,120,128,0.3)' : C.accent, color: '#fff', cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
          {busy ? 'Working…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
