import { useEffect, useRef } from 'react'
import { useThread } from '@/state/thread'
import { shouldCollapseDebateTurn } from '@/lib/messageText'
import { Message } from './Message'
import { OnboardingCard } from '@/components/Onboarding/OnboardingCard'

export function MessageList() {
  const messages = useThread((s) => s.messages)
  const streamingId = useThread((s) => s.streamingMessageId)
  const errorMessage = useThread((s) => s.errorMessage)
  const dismissError = useThread((s) => s.dismissError)

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

  return (
    <div ref={ref} className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-5 py-8 flex flex-col gap-7">
        {empty ? (
          <OnboardingCard variant="empty" />
        ) : (
          messages.map((m, i) => (
            <Message
              key={m.id}
              message={m}
              streaming={m.id === streamingId}
              collapsed={shouldCollapseDebateTurn(messages, i)}
            />
          ))
        )}
        {errorMessage && (
          <div
            role="alert"
            className="rounded-[2px] border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-start justify-between gap-2"
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
