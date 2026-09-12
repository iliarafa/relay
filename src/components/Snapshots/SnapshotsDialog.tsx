import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useSnapshots } from '@/state/snapshots'
import { useThread } from '@/state/thread'
import { Message } from '@/components/Chat/Message'
import { shouldCollapseDebateTurn } from '@/lib/messageText'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const days = Math.floor(hr / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  const date = new Date(ms)
  return date.toLocaleDateString()
}

export function SnapshotsDialog({ open, onOpenChange }: Props) {
  const snapshots = useSnapshots((s) => s.snapshots)
  const hydrate = useSnapshots((s) => s.hydrate)
  const load = useSnapshots((s) => s.load)
  const remove = useSnapshots((s) => s.remove)
  const threadHasMessages = useThread((s) => s.messages.length > 0)

  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (open) void hydrate()
    else setSelectedId(null)
  }, [open, hydrate])

  useEffect(() => {
    if (selectedId && !snapshots.some((s) => s.id === selectedId)) {
      setSelectedId(null)
    }
  }, [snapshots, selectedId])

  const selected = useMemo(
    () => snapshots.find((s) => s.id === selectedId) ?? null,
    [snapshots, selectedId],
  )

  async function handleLoad(id: string) {
    if (
      threadHasMessages &&
      !confirm('Replace the current thread with this snapshot? Save the current thread first if you want to keep it.')
    ) {
      return
    }
    await load(id)
    onOpenChange(false)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete snapshot "${name}"? This cannot be undone.`)) return
    await remove(id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {selected && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Back to list"
                onClick={() => setSelectedId(null)}
              >
                <ArrowLeft className="size-4" />
              </Button>
            )}
            <DialogTitle className="flex-1 truncate">
              {selected ? selected.name : 'Snapshots'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {selected
              ? `Saved ${relativeTime(selected.createdAt)} · ${selected.messages.length} message${selected.messages.length === 1 ? '' : 's'}`
              : 'Saved threads. Load one to seed a new rolling thread.'}
          </DialogDescription>
        </DialogHeader>

        {selected ? (
          <ScrollArea className="h-[60vh] -mx-2 px-2">
            <div className="flex flex-col gap-6 py-2">
              {selected.messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  This snapshot is empty.
                </p>
              ) : (
                selected.messages.map((m, i) => (
                  <Message
                    key={m.id}
                    message={m}
                    readOnly
                    collapsed={shouldCollapseDebateTurn(selected.messages, i)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        ) : snapshots.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No snapshots yet. Save one from the toolbar.
          </div>
        ) : (
          <ScrollArea className="h-[60vh] -mx-2 px-2">
            <ul className="flex flex-col gap-1 py-1">
              {snapshots.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-2 rounded-md hover:bg-muted px-2 py-2"
                >
                  <button
                    type="button"
                    className="flex-1 text-left"
                    onClick={() => setSelectedId(s.id)}
                  >
                    <div className="text-sm font-medium truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {relativeTime(s.createdAt)} · {s.messages.length} message
                      {s.messages.length === 1 ? '' : 's'}
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleLoad(s.id)}
                  >
                    Load
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${s.name}`}
                        onClick={() => void handleDelete(s.id, s.name)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete snapshot</TooltipContent>
                  </Tooltip>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}

        <DialogFooter>
          {selected ? (
            <>
              <Button
                variant="ghost"
                onClick={() => void handleDelete(selected.id, selected.name)}
              >
                Delete
              </Button>
              <Button onClick={() => void handleLoad(selected.id)}>
                Load as new thread
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
