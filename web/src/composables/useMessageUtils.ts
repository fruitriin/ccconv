import type { Entry, MessageContent } from './useConversations'

export function getTextContent(entry: Entry): string {
  const content = entry.message?.content
  if (!content) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter(c => c.type === 'text')
      .map(c => c.text ?? '')
      .join('\n')
  }
  return ''
}

export function isToolUse(entry: Entry): boolean {
  const content = entry.message?.content
  if (!Array.isArray(content)) return false
  return content.some(c => c.type === 'tool_use')
}

export function hasOnlyToolUse(entry: Entry): boolean {
  const content = entry.message?.content
  if (!Array.isArray(content)) return false
  const hasText = content.some(c => c.type === 'text' && c.text?.trim())
  const hasToolUse = content.some(c => c.type === 'tool_use')
  return hasToolUse && !hasText
}

export function getToolUseItems(entry: Entry): MessageContent[] {
  const content = entry.message?.content
  if (!Array.isArray(content)) return []
  return content.filter(c => c.type === 'tool_use')
}

export function getToolNames(entry: Entry): string[] {
  return getToolUseItems(entry).map(c => c.name ?? '(tool)')
}

export function getToolSummary(tool: MessageContent): string {
  const name = tool.name ?? '(tool)'
  const input = tool.input
  if (!input || typeof input !== 'object') return name
  const keys = Object.keys(input)
  if (keys.length === 0) return name
  const firstKey = keys[0]
  let val = input[firstKey]
  if (typeof val === 'string' && val.length > 50) val = val.slice(0, 50) + '...'
  return `${name}(${firstKey}=${JSON.stringify(val)})`
}

export function getToolResultContent(entry: Entry): { toolUseId: string; text: string }[] {
  const content = entry.message?.content
  if (!Array.isArray(content)) return []
  const results: { toolUseId: string; text: string }[] = []
  for (const c of content) {
    if (c.type !== 'tool_result') continue
    const id = c.tool_use_id ?? ''
    let text = ''
    if (typeof c.content === 'string') {
      text = c.content
    } else if (Array.isArray(c.content)) {
      text = c.content
        .filter((item: any) => item.type === 'text')
        .map((item: any) => item.text ?? '')
        .join('\n')
      if (!text) {
        // tool_reference 等
        text = c.content.map((item: any) => item.tool_name ?? item.type ?? '').join(', ')
      }
    }
    results.push({ toolUseId: id, text })
  }
  return results
}

export function getThinkingItems(entry: Entry): MessageContent[] {
  const content = entry.message?.content
  if (!Array.isArray(content)) return []
  return content.filter(c => c.type === 'thinking')
}

export function hasThinkingOnly(entry: Entry): boolean {
  const content = entry.message?.content
  if (!Array.isArray(content)) return false
  const hasText = content.some(c => c.type === 'text' && c.text?.trim())
  const hasToolUse = content.some(c => c.type === 'tool_use')
  const hasThinking = content.some(c => c.type === 'thinking')
  return hasThinking && !hasText && !hasToolUse
}

export function isEmptyEntry(entry: Entry, options?: { isHook: (e: Entry) => boolean; isToolResultEntry: (e: Entry) => boolean }): boolean {
  const text = getTextContent(entry)
  if (text.trim()) return false
  if (isToolUse(entry)) return false
  if (hasThinkingOnly(entry)) return false
  if (options?.isHook(entry)) return false
  if (options?.isToolResultEntry(entry)) return false
  const content = entry.message?.content
  if (!content) return true
  if (Array.isArray(content) && content.length === 0) return true
  if (Array.isArray(content) && content.every(c =>
    (c.type === 'text' && !c.text?.trim()) ||
    (c.type !== 'text' && c.type !== 'tool_use' && c.type !== 'thinking' && c.type !== 'tool_result')
  )) return true
  return false
}

export function isSkillPrompt(entry: Entry): boolean {
  if (entry.type !== 'user') return false
  const text = getTextContent(entry).trim()
  if (text.length < 200) return false
  if (text.includes('$ARGUMENTS')) return true
  if (text.startsWith('---\n') || text.startsWith('# /')) return true
  return false
}

export function getSkillName(entry: Entry): string {
  const text = getTextContent(entry).trim()
  const headerMatch = text.match(/^#\s*(\/\S+)/)
  if (headerMatch) return headerMatch[1]
  const nameMatch = text.match(/^---[\s\S]*?name:\s*(\S+)/m)
  if (nameMatch) return '/' + nameMatch[1]
  return '/skill'
}

export function formatTime(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function highlightText(text: string, search: string): string {
  if (!search) return text
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(escaped, 'gi'), m => `<mark>${m}</mark>`)
}

export function getHookPreview(entry: Entry): string {
  const content = entry.message?.content
  if (typeof content === 'string') {
    const match = content.match(/<system-reminder>([\s\S]*?)<\/system-reminder>/)
    if (match) return match[1].trim().slice(0, 120)
    return content.slice(0, 120)
  }
  if (Array.isArray(content)) {
    for (const c of content) {
      if (c.type === 'text' && c.text?.includes('<system-reminder>')) {
        const match = c.text.match(/<system-reminder>([\s\S]*?)<\/system-reminder>/)
        if (match) return match[1].trim().slice(0, 120)
      }
    }
  }
  return ''
}
