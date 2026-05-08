import type { ThreadMessage } from '@/lib/storage/db'

export function textOf(m: ThreadMessage): string {
  return m.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('')
}
