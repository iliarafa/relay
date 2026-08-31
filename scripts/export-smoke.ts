import type { ThreadMessage } from '@/lib/storage/db'
import {
  briefingTitle,
  buildBriefingHtml,
  exportFilename,
} from '@/lib/export/briefing'

function eq(label: string, got: unknown, want: unknown) {
  const a = JSON.stringify(got)
  const b = JSON.stringify(want)
  if (a === b) console.log(`ok  ${label}`)
  else {
    console.error(`FAIL ${label}\n  got:  ${a}\n  want: ${b}`)
    process.exitCode = 1
  }
}

function has(label: string, haystack: string, needle: string) {
  if (haystack.includes(needle)) console.log(`ok  ${label}`)
  else {
    console.error(`FAIL ${label}\n  missing: ${JSON.stringify(needle)}`)
    process.exitCode = 1
  }
}

function lacks(label: string, haystack: string, needle: string) {
  if (!haystack.includes(needle)) console.log(`ok  ${label}`)
  else {
    console.error(`FAIL ${label}\n  should not contain: ${JSON.stringify(needle)}`)
    process.exitCode = 1
  }
}

function msg(partial: Partial<ThreadMessage> & Pick<ThreadMessage, 'role' | 'content'>): ThreadMessage {
  return {
    id: partial.id ?? 'm1',
    createdAt: partial.createdAt ?? 1,
    provider: partial.provider,
    origin: partial.origin,
    thinking: partial.thinking,
    ...partial,
  }
}

const now = new Date(2026, 7, 31, 16, 0, 0)

eq('filename md', exportFilename(now, 'md'), 'relay-2026-08-31.md')
eq('filename html', exportFilename(now, 'html'), 'relay-2026-08-31.html')
eq('filename pdf', exportFilename(now, 'pdf'), 'relay-2026-08-31.pdf')

eq(
  'title from first user line',
  briefingTitle([
    msg({ role: 'user', content: [{ type: 'text', text: '  What is the capital of France?\nFollow up.' }] }),
  ]),
  'What is the capital of France?',
)

eq(
  'title truncates long first line',
  briefingTitle([
    msg({
      role: 'user',
      content: [{ type: 'text', text: 'A'.repeat(90) }],
    }),
  ]),
  `${'A'.repeat(80)}…`,
)

eq('title fallback', briefingTitle([]), 'Relay briefing')

const html = buildBriefingHtml(
  [
    msg({
      id: 'u1',
      role: 'user',
      content: [
        { type: 'text', text: 'Compare the two plans.\n\n<script>alert(1)</script>' },
        { type: 'image', mediaType: 'image/png', data: 'abc' },
      ],
    }),
    msg({
      id: 'a1',
      role: 'assistant',
      provider: 'claude',
      origin: { kind: 'relay', from: 'grok' },
      content: [{ type: 'text', text: '## Finding\n\n- Plan A is cheaper\n- Plan B is faster' }],
    }),
    msg({
      id: 'u2',
      role: 'user',
      origin: { kind: 'debate', from: 'claude' },
      content: [{ type: 'text', text: 'Challenge that.' }],
    }),
  ],
  { now },
)

has('doctype', html, '<!DOCTYPE html>')
has('brand', html, 'Relay')
has('document title', html, 'Compare the two plans.')
has('formal date', html, '31 August 2026')
has('message count', html, '3 messages')
has('you speaker', html, 'You')
has('claude speaker', html, 'Claude')
has('escapes script', html, '&lt;script&gt;alert(1)&lt;/script&gt;')
lacks('no raw script tag from user', html, '<script>alert(1)</script>')
has('image note', html, '1 image attached')
has('origin caption', html, 'relayed from Grok')
has('debate caption', html, 'debating Claude')
has('markdown heading', html, '<h2>')
has('markdown list', html, '<li>')
has('finding text', html, 'Plan A is cheaper')
lacks('no chat bubble class', html, 'bubble')
