import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { firstSentence, textOf } from '@/lib/messageText'
import { modelLabel } from '@/lib/models'
import type { ProviderId } from '@/lib/storage/db'
import { useSettings } from '@/state/settings'
import { useThread, type DebateState } from '@/state/thread'

const FINISHED_MS = 4000

export function DebateTracker() {
  const debate = useThread((s) => s.debate)
  const messages = useThread((s) => s.messages)
  const streamingId = useThread((s) => s.streamingMessageId)
  const errorMessage = useThread((s) => s.errorMessage)
  const claudeModel = useSettings((s) => s.claudeModel)
  const grokModel = useSettings((s) => s.grokModel)

  const [finished, setFinished] = useState<{ total: number } | null>(null)
  const prevDebate = useRef<DebateState | null>(null)

  // Show a brief "finished" note when a debate ends via its synthesis (not Stop / error).
  useEffect(() => {
    const prev = prevDebate.current
    prevDebate.current = debate
    if (prev && !debate && prev.phase === 'synthesis' && !errorMessage) {
      setFinished({ total: prev.total })
      const t = setTimeout(() => setFinished(null), FINISHED_MS)
      return () => clearTimeout(t)
    }
    if (debate) setFinished(null)
  }, [debate, errorMessage])

  if (!debate && !finished) return null

  function label(p: ProviderId): string {
    return modelLabel(p === 'claude' ? claudeModel : grokModel, p)
  }

  if (!debate && finished) {
    return (
      <Shell>
        <p className="text-xs text-muted-foreground">
          ✦ Debate finished · {finished.total} exchange{finished.total === 1 ? '' : 's'}
        </p>
      </Shell>
    )
  }
  if (!debate) return null

  const target = label(debate.target)
  const other = label(debate.target === 'claude' ? 'grok' : 'claude')
  const streaming = streamingId ? messages.find((m) => m.id === streamingId) : undefined
  const streamingText = streaming ? textOf(streaming) : ''
  const status = !streaming
    ? `${target} is reading…`
    : streamingText
      ? `${target} is writing…`
      : streaming.thinking
        ? `${target} is thinking…`
        : `${target} is reading…`

  const header =
    debate.phase === 'synthesis'
      ? `✦ Closing synthesis · ${target}`
      : `⚔ Debate · round ${debate.turn + 1} of ${debate.total} · ${target} ${
          debate.turn === 0 ? 'challenging' : 'answering'
        } ${other}`

  const headlines = messages
    .slice(debate.startIndex)
    .filter((m) => m.role === 'assistant' && m.id !== streamingId && textOf(m).length > 0)
    .map((m) => ({
      id: m.id,
      who: modelLabel(m.model, m.provider),
      line: firstSentence(textOf(m)),
    }))

  const steps = debate.total + 1

  return (
    <Shell>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium truncate">{header}</p>
        <div className="flex items-center gap-1 shrink-0" aria-hidden="true">
          {Array.from({ length: steps }, (_, i) => (
            <span
              key={i}
              className={cn(
                'size-1.5 rounded-full',
                i < debate.turn
                  ? 'bg-foreground'
                  : i === debate.turn
                    ? 'bg-foreground animate-pulse'
                    : 'bg-muted-foreground/30',
                i === steps - 1 && 'size-2',
              )}
            />
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {status}
      </p>
      {headlines.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground border-t pt-1.5 mt-0.5">
          {headlines.map((h) => (
            <li key={h.id} className="truncate">
              <span className="text-foreground/80 font-medium">{h.who}:</span> {h.line}
            </li>
          ))}
        </ul>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shrink-0 border-t bg-muted/40">
      <div className="max-w-3xl mx-auto px-4 py-2 flex flex-col gap-1 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        {children}
      </div>
    </div>
  )
}
