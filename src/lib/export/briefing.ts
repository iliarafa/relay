import { marked } from 'marked'
import type { ProviderId, ThreadMessage } from '@/lib/storage/db'
import { textOf } from '@/lib/messageText'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

const TITLE_MAX = 80

marked.setOptions({ gfm: true, breaks: true })

export function exportFilename(date: Date, ext: 'md' | 'html' | 'pdf'): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `relay-${y}-${m}-${d}.${ext}`
}

export function briefingTitle(messages: ThreadMessage[]): string {
  const first = messages.find((m) => m.role === 'user')
  const line = first ? textOf(first).split('\n')[0]?.trim() ?? '' : ''
  if (!line) return 'Relay briefing'
  if (line.length <= TITLE_MAX) return line
  return `${line.slice(0, TITLE_MAX)}…`
}

export function formatBriefingDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

export function buildBriefingHtml(
  messages: ThreadMessage[],
  opts?: { now?: Date },
): string {
  const now = opts?.now ?? new Date()
  const title = briefingTitle(messages)
  const count = messages.length
  const countLabel = `${count} message${count === 1 ? '' : 's'}`
  const sections = messages.map(renderSection).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — Relay</title>
<style>${BRIEFING_CSS}</style>
</head>
<body>
<article class="briefing">
<header class="masthead">
<p class="brand">Relay</p>
<h1>${escapeHtml(title)}</h1>
<p class="meta">${escapeHtml(formatBriefingDate(now))} · ${escapeHtml(countLabel)}</p>
</header>
${sections}
</article>
</body>
</html>`
}

function renderSection(m: ThreadMessage): string {
  const speaker = m.role === 'user' ? 'You' : speakerLabel(m.provider)
  const origin = m.origin ? originCaption(m.origin) : ''
  const imgs = imageNote(m)
  const body = textOf(m)
  const parts: string[] = []
  if (origin) parts.push(`<p class="origin">${escapeHtml(origin)}</p>`)
  if (imgs) parts.push(`<p class="note">${escapeHtml(imgs)}</p>`)
  if (body) parts.push(`<div class="prose">${renderMarkdown(body)}</div>`)

  return `<section class="turn">
<p class="speaker">${escapeHtml(speaker)}</p>
${parts.join('\n')}
</section>`
}

function speakerLabel(provider?: ProviderId): string {
  if (provider === 'claude') return 'Claude'
  if (provider === 'grok') return 'Grok'
  return 'Assistant'
}

function originCaption(origin: NonNullable<ThreadMessage['origin']>): string {
  const from = speakerLabel(origin.from)
  if (origin.kind === 'relay') return `↻ relayed from ${from}`
  if (origin.kind === 'debate') return `⚔ debating ${from}`
  if (origin.kind === 'debate-synthesis') return '✦ debate conclusion'
  return `✦ synthesizing ${from}`
}

function imageNote(m: ThreadMessage): string {
  const count = m.content.filter((b) => b.type === 'image').length
  if (count === 0) return ''
  return `${count} image${count === 1 ? '' : 's'} attached`
}

function renderMarkdown(text: string): string {
  return marked.parse(escapeHtml(text), { async: false }) as string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const BRIEFING_CSS = `
:root {
  --ink: #1a1714;
  --muted: #6b645c;
  --rule: #d8d0c4;
  --paper: #f6f1e8;
  --accent: #6e2f24;
  --serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Times New Roman", Times, serif;
  --sans: "Avenir Next", "Segoe UI", Helvetica, Arial, sans-serif;
}
* { box-sizing: border-box; }
html { color-scheme: light; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--serif);
  font-size: 17px;
  line-height: 1.65;
}
.briefing {
  max-width: 40rem;
  margin: 0 auto;
  padding: 3.5rem 1.75rem 4.5rem;
}
.masthead {
  border-bottom: 1px solid var(--rule);
  padding-bottom: 1.75rem;
  margin-bottom: 2.25rem;
}
.brand {
  margin: 0 0 1.25rem;
  font-family: var(--sans);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--accent);
}
.masthead h1 {
  margin: 0 0 0.75rem;
  font-size: 2rem;
  font-weight: 500;
  line-height: 1.25;
  letter-spacing: -0.015em;
}
.meta {
  margin: 0;
  font-family: var(--sans);
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  color: var(--muted);
}
.turn {
  padding: 1.35rem 0;
  border-bottom: 1px solid var(--rule);
}
.turn:last-child { border-bottom: 0; }
.speaker {
  margin: 0 0 0.45rem;
  font-family: var(--sans);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent);
}
.origin, .note {
  margin: 0 0 0.65rem;
  font-size: 0.92rem;
  font-style: italic;
  color: var(--muted);
}
.prose { margin: 0; }
.prose > :first-child { margin-top: 0; }
.prose > :last-child { margin-bottom: 0; }
.prose p { margin: 0.65em 0; }
.prose h1, .prose h2, .prose h3 {
  font-weight: 600;
  line-height: 1.3;
  margin: 1.1em 0 0.4em;
}
.prose h1 { font-size: 1.25rem; }
.prose h2 { font-size: 1.1rem; }
.prose h3 { font-size: 1rem; }
.prose ul, .prose ol { margin: 0.6em 0; padding-left: 1.3rem; }
.prose li { margin: 0.2em 0; }
.prose a { color: var(--accent); }
.prose code {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.86em;
  background: rgba(26, 23, 20, 0.06);
  padding: 0.1em 0.35em;
  border-radius: 3px;
}
.prose pre {
  margin: 0.9em 0;
  padding: 0.9rem 1rem;
  background: #efe8dc;
  border: 1px solid var(--rule);
  border-radius: 4px;
  overflow-x: auto;
  font-size: 0.84rem;
  line-height: 1.5;
}
.prose pre code { background: none; padding: 0; }
.prose blockquote {
  margin: 0.8em 0;
  padding-left: 1rem;
  border-left: 2px solid var(--accent);
  color: var(--muted);
}
.prose table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.9em 0;
  font-size: 0.95rem;
}
.prose th, .prose td {
  border: 1px solid var(--rule);
  padding: 0.4rem 0.55rem;
  text-align: left;
}
.prose th { font-family: var(--sans); font-size: 0.78rem; letter-spacing: 0.04em; }
@media print {
  @page { margin: 1.15in 1.05in; }
  body { background: #fff; }
  .briefing { max-width: none; padding: 0; }
  .turn { break-inside: avoid; }
}
`
