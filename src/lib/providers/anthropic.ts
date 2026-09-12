import { parseSSEStream } from '@/lib/sse'
import { isFableModel } from '@/lib/models'
import {
  ANTHROPIC_MAX_TOKENS,
  ProviderError,
  type ContentBlock,
  type ProviderMessage,
  type StreamEvent,
  type StreamRequest,
} from './types'

const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const VERSION = '2023-06-01'

interface AnthropicTextBlock {
  type: 'text'
  text: string
}
interface AnthropicImageBlock {
  type: 'image'
  source: { type: 'base64'; media_type: string; data: string }
}
type AnthropicContentBlock = AnthropicTextBlock | AnthropicImageBlock

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: AnthropicContentBlock[]
}

interface AnthropicRequestBody {
  model: string
  max_tokens: number
  stream: true
  messages: AnthropicMessage[]
  system?: string
  thinking?: { type: 'adaptive'; display: 'summarized' } | { type: 'disabled' }
  tools?: Array<{ type: string; name: string }>
}

export function buildAnthropicRequest(req: StreamRequest): AnthropicRequestBody {
  const body: AnthropicRequestBody = {
    model: req.model,
    max_tokens: ANTHROPIC_MAX_TOKENS,
    stream: true,
    messages: req.messages.map(toAnthropicMessage),
  }
  if (req.systemPrompt && req.systemPrompt.trim()) {
    body.system = req.systemPrompt
  }
  // Fable always thinks adaptively — thinking: disabled (and budget thinking)
  // return 400. Opus still accepts adaptive / disabled.
  if (!isFableModel(req.model)) {
    body.thinking = req.thinkingEnabled
      ? { type: 'adaptive', display: 'summarized' }
      : { type: 'disabled' }
  }
  if (req.webSearchEnabled) {
    body.tools = [{ type: 'web_search_20260209', name: 'web_search' }]
  }
  return body
}

function toAnthropicMessage(m: ProviderMessage): AnthropicMessage {
  return {
    role: m.role,
    content: m.content.map(toAnthropicBlock),
  }
}

function toAnthropicBlock(b: ContentBlock): AnthropicContentBlock {
  if (b.type === 'text') return { type: 'text', text: b.text }
  return {
    type: 'image',
    source: { type: 'base64', media_type: b.mediaType, data: b.data },
  }
}

export async function* streamAnthropic(req: StreamRequest): AsyncGenerator<StreamEvent> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': req.apiKey,
      'anthropic-version': VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(buildAnthropicRequest(req)),
    signal: req.signal,
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw new ProviderError(
      `Anthropic request failed (${res.status}): ${text || res.statusText}`,
      { status: res.status, body: text },
    )
  }

  const blockTypes = new Map<number, 'text' | 'thinking' | 'tool_use'>()

  for await (const evt of parseSSEStream(res.body)) {
    if (!evt.data || evt.data === '[DONE]') continue
    let payload: AnthropicStreamEvent
    try {
      payload = JSON.parse(evt.data) as AnthropicStreamEvent
    } catch {
      continue
    }

    switch (payload.type) {
      case 'content_block_start': {
        const block = payload.content_block
        if (block?.type) blockTypes.set(payload.index, block.type)
        if (block?.type === 'tool_use' && block.name) {
          yield { type: 'tool-start', tool: block.name }
        }
        break
      }
      case 'content_block_delta': {
        const blockType = blockTypes.get(payload.index)
        const delta = payload.delta
        if (delta?.type === 'text_delta' && blockType === 'text') {
          yield { type: 'text-delta', text: delta.text ?? '' }
        } else if (delta?.type === 'thinking_delta' && blockType === 'thinking') {
          yield { type: 'thinking-delta', text: delta.thinking ?? '' }
        }
        break
      }
      case 'message_stop': {
        yield { type: 'done' }
        return
      }
      case 'error': {
        const msg = payload.error?.message ?? 'Anthropic stream error'
        yield { type: 'error', message: msg }
        return
      }
    }
  }
  yield { type: 'done' }
}

interface AnthropicStreamEvent {
  type: string
  index: number
  content_block?: { type: 'text' | 'thinking' | 'tool_use'; name?: string }
  delta?: { type: string; text?: string; thinking?: string }
  error?: { message?: string }
}
