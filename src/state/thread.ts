import { create } from 'zustand'
import {
  loadThread,
  persistThread,
  type ContentBlock,
  type ProviderId,
  type ThreadMessage,
} from '@/lib/storage/db'
import { db } from '@/lib/storage/db'
import { useSettings } from '@/state/settings'
import { ProviderError, streamProvider, type ProviderMessage } from '@/lib/providers'
import { textOf } from '@/lib/messageText'

export interface SendOptions {
  images?: Array<{ mediaType: string; data: string }>
  webSearch?: boolean
}

export interface ThreadState {
  hydrated: boolean
  messages: ThreadMessage[]
  currentModel: ProviderId
  isStreaming: boolean
  streamingMessageId: string | null
  errorMessage: string | null

  hydrate: () => Promise<void>
  setCurrentModel: (m: ProviderId) => void
  sendMessage: (text: string, options?: SendOptions) => Promise<void>
  relayMessage: (id: string) => Promise<void>
  synthesizeMessage: (id: string) => Promise<void>
  loadFromSnapshot: (messages: ThreadMessage[]) => Promise<void>
  cancel: () => void
  clear: () => Promise<void>
  dismissError: () => void
}

let abortController: AbortController | null = null

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function mergeContentBlocks(a: ContentBlock[], b: ContentBlock[]): ContentBlock[] {
  const out: ContentBlock[] = []
  for (const block of [...a, ...b]) {
    const last = out[out.length - 1]
    if (block.type === 'text' && last && last.type === 'text') {
      out[out.length - 1] = { type: 'text', text: last.text + '\n\n' + block.text }
    } else {
      out.push(block)
    }
  }
  return out
}

function toProviderMessages(
  msgs: ThreadMessage[],
  targetProvider: ProviderId,
): ProviderMessage[] {
  // Skip a cross-provider assistant turn when the next message is a relay carrying
  // the same body verbatim — no need to duplicate it in the request.
  const skipIdx = new Set<number>()
  for (let i = 0; i < msgs.length - 1; i++) {
    const curr = msgs[i]
    const next = msgs[i + 1]
    if (
      curr.role === 'assistant' &&
      curr.provider &&
      curr.provider !== targetProvider &&
      next.role === 'user' &&
      next.origin?.kind === 'relay' &&
      next.origin.from === curr.provider
    ) {
      skipIdx.add(i)
    }
  }

  // Convert cross-provider assistant turns to user-role with attribution.
  // The receiving model would otherwise see those as its own prior turns.
  const stage1: ProviderMessage[] = []
  for (let i = 0; i < msgs.length; i++) {
    if (skipIdx.has(i)) continue
    const m = msgs[i]
    if (m.role === 'assistant' && m.provider && m.provider !== targetProvider) {
      const fromLabel = providerLabel(m.provider)
      const body = textOf(m)
      const newContent: ContentBlock[] = [
        { type: 'text', text: `[${fromLabel} said:]\n\n${body}` },
      ]
      for (const b of m.content) {
        if (b.type === 'image') newContent.push(b)
      }
      stage1.push({ role: 'user', content: newContent })
    } else {
      stage1.push({ role: m.role, content: [...m.content], provider: m.provider })
    }
  }

  // Anthropic requires alternating user/assistant. Merge adjacent same-role messages.
  const out: ProviderMessage[] = []
  for (const m of stage1) {
    const last = out[out.length - 1]
    if (last && last.role === m.role) {
      last.content = mergeContentBlocks(last.content, m.content)
    } else {
      out.push({ role: m.role, content: m.content, provider: m.provider })
    }
  }
  return out
}

function appendTextDelta(content: ContentBlock[], delta: string): ContentBlock[] {
  if (content.length === 0) return [{ type: 'text', text: delta }]
  const last = content[content.length - 1]
  if (last.type === 'text') {
    return [...content.slice(0, -1), { type: 'text', text: last.text + delta }]
  }
  return [...content, { type: 'text', text: delta }]
}

function providerLabel(p: ProviderId): string {
  return p === 'claude' ? 'Claude' : 'Grok'
}

function synthesizePrompt(from: ProviderId, body: string): string {
  return `Here is what ${providerLabel(from)} said. Critique and synthesize:\n\n${body}`
}

export const useThread = create<ThreadState>((set, get) => {
  async function runStream(params: {
    provider: ProviderId
    apiKey: string
    model: string
    assistantMsgId: string
    webSearch?: boolean
  }) {
    const { provider, apiKey, model, assistantMsgId, webSearch } = params
    const settings = useSettings.getState()

    abortController = new AbortController()
    const signal = abortController.signal

    const all = get().messages
    const idx = all.findIndex((m) => m.id === assistantMsgId)
    const requestMessages = toProviderMessages(
      idx === -1 ? all : all.slice(0, idx),
      provider,
    )
    let streamErrored: string | null = null

    try {
      for await (const evt of streamProvider(provider, {
        apiKey,
        model,
        systemPrompt: settings.systemPrompt,
        thinkingEnabled: settings.thinkingOn,
        thinkingBudget: settings.thinkingBudget,
        webSearchEnabled: webSearch,
        messages: requestMessages,
        signal,
      })) {
        if (signal.aborted) break
        const current = get().messages
        const i = current.findIndex((m) => m.id === assistantMsgId)
        if (i === -1) break
        const target = current[i]

        if (evt.type === 'text-delta') {
          const updated: ThreadMessage = {
            ...target,
            content: appendTextDelta(target.content, evt.text),
          }
          set({ messages: [...current.slice(0, i), updated, ...current.slice(i + 1)] })
        } else if (evt.type === 'thinking-delta') {
          const updated: ThreadMessage = {
            ...target,
            thinking: (target.thinking ?? '') + evt.text,
          }
          set({ messages: [...current.slice(0, i), updated, ...current.slice(i + 1)] })
        } else if (evt.type === 'error') {
          streamErrored = evt.message
        } else if (evt.type === 'done') {
          break
        }
      }
    } catch (e) {
      const isAbort = e instanceof DOMException && e.name === 'AbortError'
      if (!isAbort) {
        streamErrored =
          e instanceof ProviderError
            ? e.message
            : e instanceof Error
              ? e.message
              : String(e)
      }
    } finally {
      abortController = null
      const finalMessages = get().messages
      const i = finalMessages.findIndex((m) => m.id === assistantMsgId)
      const trimmedFinal =
        i !== -1 &&
        finalMessages[i].content.length === 0 &&
        !finalMessages[i].thinking
          ? [...finalMessages.slice(0, i), ...finalMessages.slice(i + 1)]
          : finalMessages
      set({
        messages: trimmedFinal,
        isStreaming: false,
        streamingMessageId: null,
        errorMessage: streamErrored,
      })
      await persistThread(trimmedFinal)
    }
  }

  function getKeyAndModel(provider: ProviderId): { apiKey: string | ''; model: string } {
    const settings = useSettings.getState()
    return {
      apiKey: provider === 'claude' ? settings.anthropicKey : settings.xaiKey,
      model: provider === 'claude' ? settings.claudeModel : settings.grokModel,
    }
  }

  return {
    hydrated: false,
    messages: [],
    currentModel: 'claude',
    isStreaming: false,
    streamingMessageId: null,
    errorMessage: null,

    async hydrate() {
      if (get().hydrated) return
      const messages = await loadThread()
      const settings = useSettings.getState()
      set({
        hydrated: true,
        messages,
        currentModel: settings.lastUsedModel,
      })
    },

    setCurrentModel(m) {
      if (get().currentModel === m) return
      set({ currentModel: m })
      void useSettings.getState().setLastUsedModel(m)
    },

    async sendMessage(text, options = {}) {
      const trimmed = text.trim()
      const images = options.images ?? []
      if (!trimmed && images.length === 0) return
      if (get().isStreaming) return

      const provider = get().currentModel
      const { apiKey, model } = getKeyAndModel(provider)
      if (!apiKey) {
        set({ errorMessage: `No API key for ${providerLabel(provider)} yet.` })
        return
      }

      const userContent: ContentBlock[] = []
      if (trimmed) userContent.push({ type: 'text', text: trimmed })
      for (const img of images) {
        userContent.push({ type: 'image', mediaType: img.mediaType, data: img.data })
      }

      const now = Date.now()
      const userMsg: ThreadMessage = {
        id: newId(),
        role: 'user',
        content: userContent,
        createdAt: now,
      }

      let messages = [...get().messages, userMsg]
      set({ messages, errorMessage: null })
      await persistThread(messages)
      const settings = useSettings.getState()
      if (settings.lastUsedModel !== provider) {
        void useSettings.getState().setLastUsedModel(provider)
      }

      const assistantMsg: ThreadMessage = {
        id: newId(),
        role: 'assistant',
        provider,
        content: [],
        createdAt: now + 1,
      }
      messages = [...messages, assistantMsg]
      set({
        messages,
        isStreaming: true,
        streamingMessageId: assistantMsg.id,
      })

      await runStream({
        provider,
        apiKey,
        model,
        assistantMsgId: assistantMsg.id,
        webSearch: options.webSearch,
      })
    },

    async relayMessage(id) {
      if (get().isStreaming) return
      const source = get().messages.find((m) => m.id === id)
      if (!source || source.role !== 'assistant' || !source.provider) return
      const body = textOf(source)
      if (!body) return

      const otherProvider: ProviderId = source.provider === 'claude' ? 'grok' : 'claude'
      const { apiKey, model } = getKeyAndModel(otherProvider)
      if (!apiKey) {
        set({ errorMessage: `No API key for ${providerLabel(otherProvider)} yet.` })
        return
      }

      const now = Date.now()
      const userMsg: ThreadMessage = {
        id: newId(),
        role: 'user',
        content: [{ type: 'text', text: body }],
        origin: { kind: 'relay', from: source.provider },
        createdAt: now,
      }
      const assistantMsg: ThreadMessage = {
        id: newId(),
        role: 'assistant',
        provider: otherProvider,
        content: [],
        createdAt: now + 1,
      }

      const messages = [...get().messages, userMsg, assistantMsg]
      set({
        messages,
        errorMessage: null,
        isStreaming: true,
        streamingMessageId: assistantMsg.id,
      })
      await persistThread(messages)

      await runStream({
        provider: otherProvider,
        apiKey,
        model,
        assistantMsgId: assistantMsg.id,
      })
    },

    async synthesizeMessage(id) {
      if (get().isStreaming) return
      const source = get().messages.find((m) => m.id === id)
      if (!source || source.role !== 'assistant' || !source.provider) return
      const body = textOf(source)
      if (!body) return

      const otherProvider: ProviderId = source.provider === 'claude' ? 'grok' : 'claude'
      const { apiKey, model } = getKeyAndModel(otherProvider)
      if (!apiKey) {
        set({ errorMessage: `No API key for ${providerLabel(otherProvider)} yet.` })
        return
      }

      const now = Date.now()
      const userMsg: ThreadMessage = {
        id: newId(),
        role: 'user',
        content: [{ type: 'text', text: synthesizePrompt(source.provider, body) }],
        origin: { kind: 'synthesize', from: source.provider },
        createdAt: now,
      }
      const assistantMsg: ThreadMessage = {
        id: newId(),
        role: 'assistant',
        provider: otherProvider,
        content: [],
        createdAt: now + 1,
      }

      const messages = [...get().messages, userMsg, assistantMsg]
      set({
        messages,
        errorMessage: null,
        isStreaming: true,
        streamingMessageId: assistantMsg.id,
      })
      await persistThread(messages)

      await runStream({
        provider: otherProvider,
        apiKey,
        model,
        assistantMsgId: assistantMsg.id,
      })
    },

    async loadFromSnapshot(snapshotMessages) {
      abortController?.abort()
      const cloned: ThreadMessage[] = snapshotMessages.map((m) => ({
        ...m,
        id: newId(),
        content: m.content.map((b) => ({ ...b })),
      }))
      set({
        messages: cloned,
        isStreaming: false,
        streamingMessageId: null,
        errorMessage: null,
      })
      await persistThread(cloned)
    },

    cancel() {
      abortController?.abort()
    },

    async clear() {
      abortController?.abort()
      set({
        messages: [],
        isStreaming: false,
        streamingMessageId: null,
        errorMessage: null,
      })
      await db.thread.clear()
    },

    dismissError() {
      set({ errorMessage: null })
    },
  }
})
