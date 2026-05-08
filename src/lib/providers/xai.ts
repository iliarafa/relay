import { parseSSEStream } from '@/lib/sse'
import {
  ProviderError,
  type ContentBlock,
  type ProviderMessage,
  type StreamEvent,
  type StreamRequest,
} from './types'

const ENDPOINT = 'https://api.x.ai/v1/chat/completions'

interface XaiTextPart {
  type: 'text'
  text: string
}
interface XaiImagePart {
  type: 'image_url'
  image_url: { url: string }
}
type XaiContentPart = XaiTextPart | XaiImagePart

interface XaiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | XaiContentPart[]
}

interface XaiRequestBody {
  model: string
  stream: true
  messages: XaiMessage[]
  search_parameters?: { mode: 'on' | 'auto' | 'off' }
}

export function buildXaiRequest(req: StreamRequest): XaiRequestBody {
  const messages: XaiMessage[] = []
  if (req.systemPrompt && req.systemPrompt.trim()) {
    messages.push({ role: 'system', content: req.systemPrompt })
  }
  for (const m of req.messages) {
    messages.push(toXaiMessage(m))
  }
  const body: XaiRequestBody = {
    model: req.model,
    stream: true,
    messages,
  }
  if (req.webSearchEnabled) {
    body.search_parameters = { mode: 'on' }
  }
  return body
}

function toXaiMessage(m: ProviderMessage): XaiMessage {
  const onlyText = m.content.every((b) => b.type === 'text')
  if (onlyText) {
    return {
      role: m.role,
      content: m.content.map((b) => (b.type === 'text' ? b.text : '')).join(''),
    }
  }
  return {
    role: m.role,
    content: m.content.map(toXaiPart),
  }
}

function toXaiPart(b: ContentBlock): XaiContentPart {
  if (b.type === 'text') return { type: 'text', text: b.text }
  return {
    type: 'image_url',
    image_url: { url: `data:${b.mediaType};base64,${b.data}` },
  }
}

export async function* streamXai(req: StreamRequest): AsyncGenerator<StreamEvent> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify(buildXaiRequest(req)),
    signal: req.signal,
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw new ProviderError(`xAI request failed (${res.status}): ${text || res.statusText}`, {
      status: res.status,
      body: text,
    })
  }

  for await (const evt of parseSSEStream(res.body)) {
    if (!evt.data) continue
    if (evt.data === '[DONE]') {
      yield { type: 'done' }
      return
    }
    let payload: XaiStreamChunk
    try {
      payload = JSON.parse(evt.data) as XaiStreamChunk
    } catch {
      continue
    }

    const choice = payload.choices?.[0]
    const delta = choice?.delta
    if (!delta) continue

    if (typeof delta.reasoning_content === 'string' && delta.reasoning_content.length > 0) {
      yield { type: 'thinking-delta', text: delta.reasoning_content }
    }
    if (typeof delta.content === 'string' && delta.content.length > 0) {
      yield { type: 'text-delta', text: delta.content }
    }

    if (choice?.finish_reason) {
      yield { type: 'done' }
      return
    }
  }
  yield { type: 'done' }
}

interface XaiStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string
      reasoning_content?: string
    }
    finish_reason?: string | null
  }>
}
