import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { KEY_PREFIX, keyLooksValid, maskKey, type KeyProvider } from '@/lib/apiKeys'
import { verifyApiKey, type KeyVerdict } from '@/lib/providers/verify'

const PROVIDER_NAME: Record<KeyProvider, string> = { anthropic: 'Anthropic', xai: 'xAI' }

type Status = 'idle' | 'checking' | KeyVerdict

interface Verdict {
  key: string
  verdict: KeyVerdict
}

/**
 * One API key. Empty → a narrow input with the key's prefix as placeholder.
 * A well-formed key collapses into a masked chip (`sk-ant-…3f9a`) with a
 * live verdict from the provider. The full key is never displayed.
 */
export function ApiKeyField({
  id,
  provider,
  value,
  onChange,
}: {
  id: string
  provider: KeyProvider
  value: string
  onChange: (next: string) => void
}) {
  const wellFormed = keyLooksValid(provider, value)
  // Replace forces the input open until a well-formed key is entered again.
  const [replacing, setReplacing] = useState(false)
  const editing = !wellFormed || replacing
  // The provider's verdict for a specific key string; derived status below.
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const trimmed = value.trim()
  const status: Status = !wellFormed
    ? 'idle'
    : verdict && verdict.key === trimmed
      ? verdict.verdict
      : 'checking'

  // Verify with the provider whenever a well-formed key is present.
  useEffect(() => {
    if (!wellFormed) return
    const ctrl = new AbortController()
    const key = trimmed
    const t = setTimeout(() => {
      verifyApiKey(provider, key, ctrl.signal)
        .then((v) => setVerdict({ key, verdict: v }))
        .catch(() => {})
    }, 300)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [provider, trimmed, wellFormed])

  function handleChange(next: string) {
    onChange(next)
    if (keyLooksValid(provider, next)) setReplacing(false)
  }

  function replace() {
    onChange('')
    setReplacing(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const name = PROVIDER_NAME[provider]
  const showHint = editing && value.trim().length > 0 && !wellFormed

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{name} API key</Label>
      {editing ? (
        <>
          <Input
            ref={inputRef}
            id={id}
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            placeholder={`${KEY_PREFIX[provider]}…`}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className="max-w-xs font-mono text-[13px] tracking-wide rounded-[2px]"
          />
          {showHint && (
            <span className="text-xs text-muted-foreground">
              {name} keys start with {KEY_PREFIX[provider]}
            </span>
          )}
        </>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className={cn(
              'inline-flex items-center gap-2 rounded-[2px] border px-2.5 h-8 font-mono text-[13px] tracking-wide',
              status === 'rejected' ? 'border-destructive/60' : 'border-border',
            )}
            aria-live="polite"
          >
            {status === 'rejected' ? (
              <X className="size-3.5 text-destructive" aria-hidden="true" />
            ) : (
              <Check
                className={cn(
                  'size-3.5',
                  status === 'ok' ? 'text-emerald-500' : 'text-muted-foreground',
                  status === 'checking' && 'animate-pulse',
                )}
                aria-hidden="true"
              />
            )}
            <span>{maskKey(provider, value)}</span>
          </div>
          <span
            className={cn(
              'text-xs',
              status === 'rejected'
                ? 'text-destructive'
                : status === 'ok'
                  ? 'text-emerald-500'
                  : 'text-muted-foreground',
            )}
          >
            {status === 'ok' && 'Valid API key'}
            {status === 'checking' && 'Checking with ' + name + '…'}
            {status === 'rejected' && `${name} rejected this key`}
            {status === 'unreachable' && 'Key entered — could not reach ' + name + ' to verify'}
            {status === 'idle' && 'Key entered'}
          </span>
          <Button variant="ghost" size="xs" className="label" onClick={replace}>
            Replace
          </Button>
        </div>
      )}
    </div>
  )
}
