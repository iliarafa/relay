import { ChevronRight } from 'lucide-react'
import { useState } from 'react'

export function ThinkingBlock({
  text,
  streaming,
  autoOpen,
}: {
  text: string
  streaming?: boolean
  /** Open while true (e.g. streaming with no answer text yet); folds when it turns false. */
  autoOpen?: boolean
}) {
  // A manual click takes over; until then the block follows `autoOpen`.
  const [manual, setManual] = useState<boolean | null>(null)
  const open = manual ?? !!autoOpen

  return (
    <div className="text-xs text-muted-foreground">
      <button
        type="button"
        onClick={() => setManual(!open)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <ChevronRight
          className={`size-3 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <span>{streaming ? 'Thinking…' : 'Thinking'}</span>
      </button>
      {open && (
        <div className="mt-1 ml-4 pl-3 border-l border-border whitespace-pre-wrap max-h-64 overflow-y-auto">
          {text}
        </div>
      )}
    </div>
  )
}
