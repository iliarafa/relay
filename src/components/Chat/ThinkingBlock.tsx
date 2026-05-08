import { ChevronRight } from 'lucide-react'
import { useState } from 'react'

export function ThinkingBlock({ text, streaming }: { text: string; streaming?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="text-xs text-muted-foreground">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <ChevronRight
          className={`size-3 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <span>{streaming ? 'Thinking…' : 'Thinking'}</span>
      </button>
      {open && (
        <div className="mt-1 ml-4 pl-3 border-l border-border whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  )
}
