import type { ContentBlock, ProviderId } from '@/lib/storage/db'

export type { ContentBlock, ProviderId }

export interface ProviderMessage {
  role: 'user' | 'assistant'
  content: ContentBlock[]
  provider?: ProviderId
}

export type StreamEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'thinking-delta'; text: string }
  | { type: 'tool-start'; tool: string }
  | { type: 'error'; message: string }
  | { type: 'done' }

export interface StreamRequest {
  apiKey: string
  model: string
  systemPrompt?: string
  messages: ProviderMessage[]
  thinkingEnabled?: boolean
  thinkingBudget?: number
  webSearchEnabled?: boolean
  signal?: AbortSignal
}

export class ProviderError extends Error {
  status?: number
  body?: unknown
  constructor(message: string, opts: { status?: number; body?: unknown } = {}) {
    super(message)
    this.name = 'ProviderError'
    this.status = opts.status
    this.body = opts.body
  }
}

export const ANTHROPIC_MAX_TOKENS = 8192
