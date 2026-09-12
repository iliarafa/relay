import { useState } from 'react'
import { ArrowRightLeft, Check, ChevronDown, ChevronUp, Copy, Sparkles, Swords } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Markdown } from '@/lib/markdown'
import { firstParagraph, isDebatePrompt, textOf } from '@/lib/messageText'
import { messageToMarkdown } from '@/lib/threadMarkdown'
import { modelLabel } from '@/lib/models'
import type { ProviderId, ThreadMessage } from '@/lib/storage/db'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useThread } from '@/state/thread'
import { useSettings } from '@/state/settings'
import { ThinkingBlock } from './ThinkingBlock'

function providerLabel(provider?: ProviderId, model?: string): string {
  return modelLabel(model, provider)
}

function originCaption(origin: NonNullable<ThreadMessage['origin']>): string {
  const fromLabel = providerLabel(origin.from)
  if (origin.kind === 'relay') return `↻ relayed from ${fromLabel}`
  if (origin.kind === 'debate') return `⚔ debating ${fromLabel}`
  if (origin.kind === 'debate-synthesis') return '✦ debate conclusion'
  return `✦ synthesizing ${fromLabel}`
}

export function Message({
  message,
  streaming,
  readOnly,
  collapsed,
}: {
  message: ThreadMessage
  streaming?: boolean
  readOnly?: boolean
  /** Fold this (debate) turn to its first paragraph. The user's toggle overrides. */
  collapsed?: boolean
}) {
  const isUser = message.role === 'user'
  const text = textOf(message)
  const debatePrompt = isUser && isDebatePrompt(message)
  const [showPrompt, setShowPrompt] = useState(false)
  const [userToggle, setUserToggle] = useState<boolean | null>(null)
  const { preview, truncated } = firstParagraph(text)
  const images = message.content.filter(
    (b): b is { type: 'image'; mediaType: string; data: string } => b.type === 'image',
  )
  const showCursor = streaming && message.role === 'assistant'
  // Fold only when there is something to fold; streaming turns always render in full.
  const foldable = !isUser && !!collapsed && truncated && !showCursor
  const isCollapsed = foldable && (userToggle === null ? true : !userToggle)

  const isStreaming = useThread((s) => s.isStreaming)
  const relayMessage = useThread((s) => s.relayMessage)
  const synthesizeMessage = useThread((s) => s.synthesizeMessage)
  const isDebating = useThread((s) => s.isDebating)
  const debateMessage = useThread((s) => s.debateMessage)
  const debateRounds = useSettings((s) => s.debateRounds)
  const anthropicKey = useSettings((s) => s.anthropicKey)
  const xaiKey = useSettings((s) => s.xaiKey)

  const [copied, setCopied] = useState(false)

  const showRelaySynthesize =
    !readOnly && !isUser && !!message.provider && !showCursor && text.length > 0
  const showCopy = !readOnly && !showCursor && text.length > 0 && (!debatePrompt || showPrompt)
  const showActionRow = showCopy

  const otherProvider: ProviderId | null = message.provider
    ? message.provider === 'claude'
      ? 'grok'
      : 'claude'
    : null
  const otherKey =
    otherProvider === 'claude' ? anthropicKey : otherProvider === 'grok' ? xaiKey : ''
  const otherLabel = otherProvider ? providerLabel(otherProvider) : ''

  const busy = isStreaming || isDebating
  const relaySynthDisabled = busy || !otherKey
  const disabledReason = busy
    ? 'Wait for the current response to finish'
    : !otherKey
      ? `Add a ${otherLabel} API key in Settings`
      : ''

  const debateDisabled = busy || !anthropicKey || !xaiKey
  const debateDisabledReason = busy
    ? 'Wait for the current response to finish'
    : !anthropicKey || !xaiKey
      ? `Debate needs both API keys — add the ${!anthropicKey ? 'Anthropic' : 'xAI'} key in Settings`
      : ''

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(messageToMarkdown(message))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      console.error('copy failed', e)
    }
  }

  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn('flex flex-col gap-1.5 max-w-[85%]', isUser ? 'items-end' : 'items-start')}
      >
        {!isUser && message.provider && (
          <span className="text-xs text-muted-foreground px-1">
            {providerLabel(message.provider, message.model)}
          </span>
        )}
        {isUser && message.origin && (
          <span className="text-xs text-muted-foreground px-1 inline-flex items-center gap-2">
            {originCaption(message.origin)}
            {debatePrompt && (
              <button
                type="button"
                onClick={() => setShowPrompt((v) => !v)}
                className="underline underline-offset-2 opacity-70 hover:opacity-100"
              >
                {showPrompt ? 'hide prompt' : 'show prompt'}
              </button>
            )}
          </span>
        )}
        {message.thinking && (
          <div className={cn('px-1', isUser && 'text-right')}>
            <ThinkingBlock
              text={message.thinking}
              streaming={showCursor && !text}
              autoOpen={showCursor && !text}
            />
          </div>
        )}
        {(!debatePrompt || showPrompt) &&
          (text || images.length > 0 || !message.thinking || !showCursor) && (
            <div
              className={cn(
                'rounded-2xl px-4 py-2.5 flex flex-col gap-2',
                isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
              )}
            >
              {images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {images.map((img, i) => (
                    <img
                      key={i}
                      src={`data:${img.mediaType};base64,${img.data}`}
                      alt=""
                      className="rounded-md max-h-48 max-w-full object-cover"
                    />
                  ))}
                </div>
              )}
              {isUser
                ? text &&
                  (message.origin ? (
                    <Markdown text={text} />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap break-words">{text}</p>
                  ))
                : (text || showCursor) && (
                    <div>
                      <Markdown text={isCollapsed ? preview : text} />
                      {showCursor && (
                        <span className="inline-block w-2 h-3.5 align-text-bottom bg-current opacity-60 animate-pulse ml-0.5" />
                      )}
                      {foldable && (
                        <button
                          type="button"
                          onClick={() => setUserToggle(isCollapsed)}
                          className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {isCollapsed ? (
                            <>
                              <ChevronDown className="size-3" /> Show more
                            </>
                          ) : (
                            <>
                              <ChevronUp className="size-3" /> Show less
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
            </div>
          )}
        {showActionRow && (
          <div className="flex items-center gap-1 px-1">
            {showRelaySynthesize && otherProvider && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Relay to ${otherLabel}`}
                      disabled={relaySynthDisabled}
                      onClick={() => void relayMessage(message.id)}
                    >
                      <ArrowRightLeft className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {relaySynthDisabled ? disabledReason : `Relay to ${otherLabel}`}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Ask ${otherLabel} to synthesize`}
                      disabled={relaySynthDisabled}
                      onClick={() => void synthesizeMessage(message.id)}
                    >
                      <Sparkles className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {relaySynthDisabled ? disabledReason : `Ask ${otherLabel} to synthesize`}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Start debate"
                      disabled={debateDisabled}
                      onClick={() => void debateMessage(message.id)}
                    >
                      <Swords className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {debateDisabled
                      ? debateDisabledReason
                      : `Debate: ${debateRounds} exchange${debateRounds === 1 ? '' : 's'} + synthesis`}
                  </TooltipContent>
                </Tooltip>
              </>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Copy message"
                  onClick={() => void handleCopy()}
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{copied ? 'Copied' : 'Copy as markdown'}</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  )
}
