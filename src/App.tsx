import { useEffect, useState } from 'react'
import {
  BookmarkPlus,
  Check,
  Copy,
  Library,
  Settings as SettingsIcon,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { SettingsDialog } from '@/components/Settings/SettingsDialog'
import { SaveSnapshotDialog } from '@/components/Snapshots/SaveSnapshotDialog'
import { SnapshotsDialog } from '@/components/Snapshots/SnapshotsDialog'
import { ChatView } from '@/components/Chat/ChatView'
import { useSettings } from '@/state/settings'
import { useThread } from '@/state/thread'
import { useSnapshots } from '@/state/snapshots'
import { applyTheme, watchSystemTheme } from '@/lib/theme'
import { threadToMarkdown } from '@/lib/threadMarkdown'

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [saveSnapshotOpen, setSaveSnapshotOpen] = useState(false)
  const [snapshotsOpen, setSnapshotsOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const settingsHydrated = useSettings((s) => s.hydrated)
  const theme = useSettings((s) => s.theme)
  const threadHydrated = useThread((s) => s.hydrated)
  const hasMessages = useThread((s) => s.messages.length > 0)
  const clearThread = useThread((s) => s.clear)

  useEffect(() => {
    void (async () => {
      await useSettings.getState().hydrate()
      await useThread.getState().hydrate()
      await useSnapshots.getState().hydrate()
    })()
  }, [])

  useEffect(() => {
    if (!settingsHydrated) return
    applyTheme(theme)
    return watchSystemTheme(() => useSettings.getState().theme)
  }, [settingsHydrated, theme])

  function handleClear() {
    if (confirm('Clear the current thread? Snapshot it first if you want to keep it.')) {
      void clearThread()
    }
  }

  async function handleCopyThread() {
    const messages = useThread.getState().messages
    if (messages.length === 0) return
    try {
      await navigator.clipboard.writeText(threadToMarkdown(messages))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      console.error('copy thread failed', e)
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="bg-background text-foreground min-h-screen flex flex-col">
        <header className="flex items-center justify-between px-4 py-2 border-b shrink-0 pt-[max(0.5rem,env(safe-area-inset-top))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
          <h1 className="text-base font-medium">RELAY</h1>
          <div className="flex items-center gap-1">
            {hasMessages && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Copy thread as markdown"
                      onClick={() => void handleCopyThread()}
                    >
                      {copied ? (
                        <Check className="size-4" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {copied ? 'Copied' : 'Copy thread as markdown'}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Save snapshot"
                      onClick={() => setSaveSnapshotOpen(true)}
                    >
                      <BookmarkPlus className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Save snapshot</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Clear thread"
                      onClick={handleClear}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Clear thread</TooltipContent>
                </Tooltip>
              </>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Snapshots"
                  onClick={() => setSnapshotsOpen(true)}
                >
                  <Library className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Snapshots</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Settings"
                  onClick={() => setSettingsOpen(true)}
                >
                  <SettingsIcon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>
          </div>
        </header>

        {threadHydrated ? (
          <ChatView />
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        )}

        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
        <SaveSnapshotDialog
          open={saveSnapshotOpen}
          onOpenChange={setSaveSnapshotOpen}
        />
        <SnapshotsDialog open={snapshotsOpen} onOpenChange={setSnapshotsOpen} />
      </div>
    </TooltipProvider>
  )
}

export default App
