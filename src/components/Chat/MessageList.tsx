import { useEffect, useRef } from 'react'
import { useThread } from '@/state/thread'
import { useSettings } from '@/state/settings'
import { Message } from './Message'

export function MessageList() {
  const messages = useThread((s) => s.messages)
  const streamingId = useThread((s) => s.streamingMessageId)
  const errorMessage = useThread((s) => s.errorMessage)
  const dismissError = useThread((s) => s.dismissError)
  const anthropicKey = useSettings((s) => s.anthropicKey)
  const xaiKey = useSettings((s) => s.xaiKey)

  const ref = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handler = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight
      stickToBottom.current = distance < 100
    }
    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || !stickToBottom.current) return
    el.scrollTop = el.scrollHeight
  }, [messages, streamingId])

  const empty = messages.length === 0
  const noKeys = !anthropicKey && !xaiKey

  return (
    <div ref={ref} className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
        {empty ? (
          <div className="text-center text-muted-foreground py-16">
            <p className="text-base">Start a conversation</p>
            {noKeys ? (
              <p className="text-sm mt-2">Open Settings (top-right) to add your API keys.</p>
            ) : (
              <p className="text-sm mt-2">Pick a model below and send a message.</p>
            )}
          </div>
        ) : (
          messages.map((m) => (
            <Message key={m.id} message={m} streaming={m.id === streamingId} />
          ))
        )}
        {errorMessage && (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-start justify-between gap-2"
          >
            <span className="flex-1">{errorMessage}</span>
            <button
              type="button"
              onClick={dismissError}
              className="text-xs underline opacity-80 hover:opacity-100"
            >
              dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
