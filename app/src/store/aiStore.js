import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// The project store lives in one fixed IOsense insight — users don't pick it.
// Connecting an account (Settings token / pasted SSO / ?token= URL) is all it takes.
export const DEFAULT_INSIGHT_ID = 'INS_f059ef2f1184'

// Bruce runs as an agent on the IOsense AI Agents platform (see "bruce creds" +
// skills/BRUCE_AGENT_PROMPT.md). The key is agent-scoped (`agv2_…`) and the
// system prompt/skills live on the agent — no user model/API key needed.
export const DEFAULT_BRUCE_URL = 'https://bruce-staging.iosense.io'
export const DEFAULT_BRUCE_KEY = 'agv2_05CWg_tjxsPfyezmsdJgi_crjRnGFmeeFy5KX0nVfzo'
export const DEFAULT_BRUCE_AGENT_ID = '6a4d0e6d26eb698050e3529b'

// The conversation itself is stored PER PROJECT in projectStore; the platform
// keeps its own server-side history per session (bruceSessions maps project → session).
export const useAIStore = create(
  persist(
    (set) => ({
      // ── Bruce agent (IOsense AI Agents platform) ──
      bruceUrl: DEFAULT_BRUCE_URL,
      bruceApiKey: DEFAULT_BRUCE_KEY,
      bruceAgentId: DEFAULT_BRUCE_AGENT_ID,   // the Bruce agent on the platform
      bruceSessions: {},       // projectId → platform session_id (server-side history)

      // ── IOsense UNS (live data) ──
      unsToken: '',                                       // Bearer token (PAT)
      unsBaseUrl: 'https://stagingsv.iosense.io/api',     // resolveAndCompute host
      unsGraph: 'iosense_test_uns',                       // env UNS graph name

      // ── IOsense UNS namespace BROWSER (slash-picker; topology service) ──
      unsBrowseToken: '',                                          // session JWT from an SSO exchange (already "Bearer …")
      unsBrowseBaseUrl: 'https://uns-backend-server.iosense.io',   // workspaces / nodes-skeleton host

      // ── IOsense account (SSO connect + insights) ──
      iosenseJWT: '',                                     // Bearer JWT (from ?token= or PAT)
      iosenseOrg: '',
      iosenseUserId: '',
      iosenseName: '',                                    // connected user's display name
      iosenseEmail: '',                                   // connected user's email
      iosenseOrgName: '',                                 // organisation name
      iosenseBaseUrl: 'https://connector.iosense.io/api', // insights / account host
      insightId: DEFAULT_INSIGHT_ID,                      // fixed "projects" insight collection
      insights: [],                                       // last-fetched list (not persisted)
      chatSeed: '',                                       // transient: prefill text for Bruce's input (not persisted)

      setConfig: (patch) => set(patch),
      setBruceSession: (projectId, sessionId) => set(s => ({
        bruceSessions: { ...s.bruceSessions, [projectId]: sessionId || undefined },
      })),
    }),
    {
      name: 'faclon-dt-ai',
      version: 5,
      // v2: the insight is fixed — backfill it onto older persisted state.
      // v3: the BYO model/API-key config is gone — Bruce is the platform agent.
      // v4/v5: the Bruce agent id + key are fixed (hardcoded, verified live).
      migrate: (state, version) => {
        if (state && (version < 2 || !state.insightId)) state.insightId = DEFAULT_INSIGHT_ID
        if (state && version < 3) {
          delete state.provider; delete state.model; delete state.apiKey; delete state.baseUrl; delete state.maxTokens
          state.bruceUrl = DEFAULT_BRUCE_URL
          state.bruceSessions = state.bruceSessions || {}
        }
        if (state && version < 5) {
          state.bruceAgentId = DEFAULT_BRUCE_AGENT_ID
          state.bruceApiKey = DEFAULT_BRUCE_KEY
        }
        return state
      },
      partialize: (s) => ({
        bruceUrl: s.bruceUrl, bruceApiKey: s.bruceApiKey, bruceAgentId: s.bruceAgentId, bruceSessions: s.bruceSessions,
        unsToken: s.unsToken, unsBaseUrl: s.unsBaseUrl, unsGraph: s.unsGraph,
        unsBrowseToken: s.unsBrowseToken, unsBrowseBaseUrl: s.unsBrowseBaseUrl,
        iosenseJWT: s.iosenseJWT, iosenseOrg: s.iosenseOrg, iosenseUserId: s.iosenseUserId, iosenseName: s.iosenseName, iosenseEmail: s.iosenseEmail, iosenseOrgName: s.iosenseOrgName, iosenseBaseUrl: s.iosenseBaseUrl, insightId: s.insightId,
      }),
    }
  )
)

export const aiConfigured = (s) => !!(s.bruceUrl && s.bruceApiKey && s.bruceAgentId)
