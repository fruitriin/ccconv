import { reactive, computed } from 'vue'

export interface Project {
  name: string
  fileCount: number
  lastUpdate: string
  totalMessages: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cwd: string
  gitBranch: string
  sessionStart: string
  sessionEnd: string
  subagentCount: number
}

export interface Session {
  sessionId: string
  lastUpdate: string
  messageCount: number
  subagentCount: number
  inputTokens: number
  outputTokens: number
}

export interface MessageContent {
  type: string
  text?: string
  thinking?: string
  id?: string
  name?: string
  input?: any
  tool_use_id?: string
  content?: any
}

export interface Message {
  role?: string
  content?: string | MessageContent[]
  model?: string
  usage?: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
}

export interface Entry {
  parentUuid?: string
  isSidechain?: boolean
  userType?: string
  cwd?: string
  sessionId?: string
  version?: string
  gitBranch?: string
  agentId?: string
  type?: string
  message?: Message
  uuid?: string
  timestamp?: string
  requestId?: string
  _filePath?: string
  _projectDir?: string
  _fileName?: string
  _isSubagent?: boolean
  _parentSession?: string
  _agentId?: string
}

export type TriState = 'hidden' | 'collapsed' | 'expanded'

export interface Filters {
  user: boolean
  assistant: boolean
  tools: TriState
  thinking: TriState
  hooks: boolean
  subagents: TriState
}

const state = reactive({
  projects: [] as Project[],
  sessions: [] as Session[],
  conversations: [] as Entry[],
  selectedProject: null as string | null,
  selectedSession: null as string | null,
  loading: false,
  sinceFilter: 'today' as string,
  searchText: '' as string,
  anchorUuid: null as string | null,
  viewMode: 'linear' as 'linear' | 'pane' | 'pane-flow',
  filters: {
    user: true,
    assistant: true,
    tools: 'hidden' as TriState,
    thinking: 'hidden' as TriState,
    hooks: false,
    subagents: 'collapsed' as TriState,
  } as Filters,
})

function isHook(entry: Entry): boolean {
  const content = entry.message?.content
  if (typeof content === 'string') return content.includes('<system-reminder>')
  if (Array.isArray(content)) return content.some(c =>
    (c.type === 'text' && c.text?.includes('<system-reminder>')) ||
    (c.type === 'tool_result' && typeof c.content === 'string' && c.content.includes('<system-reminder>'))
  )
  return false
}

function isToolResultEntry(entry: Entry): boolean {
  const content = entry.message?.content
  if (!Array.isArray(content)) return false
  return content.some(c => c.type === 'tool_result')
}

const filteredConversations = computed(() => {
  return state.conversations.filter(entry => {
    if (entry._isSubagent) return state.filters.subagents !== 'hidden'
    if (isHook(entry)) return state.filters.hooks
    if (isToolResultEntry(entry)) return state.filters.tools !== 'hidden'
    if (entry.type === 'user') return state.filters.user
    if (entry.type === 'assistant') {
      const content = entry.message?.content
      if (Array.isArray(content)) {
        const hasText = content.some(c => c.type === 'text' && c.text?.trim())
        const hasToolUse = content.some(c => c.type === 'tool_use')
        const hasThinking = content.some(c => c.type === 'thinking')

        if (hasThinking && !hasText && !hasToolUse) return state.filters.thinking !== 'hidden'
        if (hasToolUse && !hasText) return state.filters.tools !== 'hidden'
        // テキストもツールもthinkingもない空エントリを除外
        if (!hasText && !hasToolUse && !hasThinking) return false
        return state.filters.assistant
      }
      // content が配列でない場合
      if (!content || (typeof content === 'string' && !content.trim())) return false
      return state.filters.assistant
    }
    // type が user でも assistant でもない空エントリ
    if (!entry.message?.content) return false
    return true
  })
})

async function fetchProjects() {
  state.loading = true
  try {
    const sinceParam = state.sinceFilter === 'today' ? '' : `?since=${state.sinceFilter}`
    const res = await fetch(`/api/projects${sinceParam}`)
    state.projects = await res.json()
  } catch (e) {
    console.error('fetchProjects failed', e)
    state.projects = []
  } finally {
    state.loading = false
  }
}

async function fetchSessions(project: string) {
  state.loading = true
  try {
    const res = await fetch(`/api/sessions?project=${encodeURIComponent(project)}`)
    const data: any[] = await res.json()
    // server返却がEntry[]の場合はセッションにまとめる
    // sessions APIはProjectSummary[]またはSessionSummary[]を返す
    state.sessions = data as Session[]
  } catch (e) {
    console.error('fetchSessions failed', e)
    state.sessions = []
  } finally {
    state.loading = false
  }
}

async function fetchConversations(project: string, session: string) {
  state.loading = true
  try {
    const res = await fetch(
      `/api/conversations?project=${encodeURIComponent(project)}&session=${encodeURIComponent(session)}&subagents=true`
    )
    state.conversations = await res.json()
  } catch (e) {
    console.error('fetchConversations failed', e)
    state.conversations = []
  } finally {
    state.loading = false
  }
}

function pushUrl() {
  const parts = ['#']
  if (state.selectedProject) {
    parts.push(encodeURIComponent(state.selectedProject))
    if (state.selectedSession) {
      parts.push(state.selectedSession)
    }
  }
  const hash = parts.length > 1 ? parts.join('/') : ''
  if (window.location.hash !== hash) {
    history.pushState(null, '', hash || window.location.pathname)
  }
}

async function selectProject(name: string) {
  state.selectedProject = name
  state.selectedSession = null
  state.conversations = []
  pushUrl()
  await fetchSessions(name)
  // 最新セッションを自動選択
  if (state.sessions.length > 0) {
    selectSession(state.sessions[0].sessionId)
  }
}

function selectSession(sessionId: string) {
  state.selectedSession = sessionId
  pushUrl()
  if (state.selectedProject) {
    fetchConversations(state.selectedProject, sessionId)
  }
}

function setSinceFilter(since: string) {
  state.sinceFilter = since
  state.selectedProject = null
  state.selectedSession = null
  state.sessions = []
  state.conversations = []
  pushUrl()
  fetchProjects()
}

// URL からの復元
async function restoreFromUrl() {
  const hash = window.location.hash
  if (!hash || hash === '#') return

  const parts = hash.slice(1).split('/').filter(Boolean)
  if (parts.length >= 1) {
    const project = decodeURIComponent(parts[0])
    state.selectedProject = project
    // since=all にしてプロジェクトを確実に表示
    state.sinceFilter = 'all'
    await fetchProjects()
    await fetchSessions(project)

    if (parts.length >= 2) {
      const session = parts[1]
      state.selectedSession = session
      await fetchConversations(project, session)
    }
  }
}

// ブラウザの戻る/進むに対応
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    restoreFromUrl()
  })
}

export function useConversations() {
  return {
    state,
    filteredConversations,
    isHook,
    isToolResultEntry,
    fetchProjects,
    fetchSessions,
    fetchConversations,
    selectProject,
    selectSession,
    setSinceFilter,
    restoreFromUrl,
  }
}
