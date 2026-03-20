import { reactive } from 'vue'

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

const state = reactive({
  projects: [] as Project[],
  sessions: [] as Session[],
  conversations: [] as Entry[],
  selectedProject: null as string | null,
  selectedSession: null as string | null,
  loading: false,
  sinceFilter: 'today' as string,
  typeFilter: 'all' as string,
  searchText: '' as string,
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

function selectProject(name: string) {
  state.selectedProject = name
  state.selectedSession = null
  state.conversations = []
  fetchSessions(name)
}

function selectSession(sessionId: string) {
  state.selectedSession = sessionId
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
  fetchProjects()
}

export function useConversations() {
  return {
    state,
    fetchProjects,
    fetchSessions,
    fetchConversations,
    selectProject,
    selectSession,
    setSinceFilter,
  }
}
