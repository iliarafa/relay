import type { ProviderId, ThreadMessage } from '@/lib/storage/db'
import { textOf } from '@/lib/messageText'

function providerLabel(p?: ProviderId): string {
  if (p === 'claude') return 'Claude'
  if (p === 'grok') return 'Grok'
  return ''
}

function originLine(origin: NonNullable<ThreadMessage['origin']>): string {
  const fromLabel = providerLabel(origin.from)
  if (origin.kind === 'relay') return `_↻ relayed from ${fromLabel}_`
  if (origin.kind === 'debate') return `_⚔ debating ${fromLabel}_`
  if (origin.kind === 'debate-synthesis') return '_✦ debate conclusion_'
  return `_✦ synthesizing ${fromLabel}_`
}

function imageNote(m: ThreadMessage): string {
  const count = m.content.filter((b) => b.type === 'image').length
  if (count === 0) return ''
  return `_[${count} image${count === 1 ? '' : 's'} attached]_`
}

export function messageToMarkdown(m: ThreadMessage): string {
  const body = textOf(m)
  const imgs = imageNote(m)
  const parts: string[] = []
  if (m.role === 'user' && m.origin) parts.push(originLine(m.origin))
  if (imgs) parts.push(imgs)
  if (body) parts.push(body)
  return parts.join('\n\n')
}

export function threadToMarkdown(messages: ThreadMessage[]): string {
  const blocks: string[] = []
  for (const m of messages) {
    const heading =
      m.role === 'user' ? '**You:**' : `**${providerLabel(m.provider) || 'Assistant'}:**`
    const body = messageToMarkdown(m)
    blocks.push(body ? `${heading}\n\n${body}` : heading)
  }
  return blocks.join('\n\n---\n\n')
}
