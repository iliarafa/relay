import { useEffect, useState } from 'react'
import {
  BookmarkPlus,
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
import { useUi } from '@/state/ui'
import { AboutDialog } from '@/components/Onboarding/AboutDialog'
import { ExportMenu } from '@/components/Export/ExportMenu'
import { applyFontScale, applyTheme, watchSystemTheme } from '@/lib/theme'

function App() {
  const settingsOpen = useUi((s) => s.settingsOpen)
  const setSettingsOpen = useUi((s) => s.setSettingsOpen)
  const [saveSnapshotOpen, setSaveSnapshotOpen] = useState(false)
  const [snapshotsOpen, setSnapshotsOpen] = useState(false)
  const settingsHydrated = useSettings((s) => s.hydrated)
  const theme = useSettings((s) => s.theme)
  const fontScale = useSettings((s) => s.fontScale)
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

  useEffect(() => {
    if (!settingsHydrated) return
    applyFontScale(fontScale)
  }, [settingsHydrated, fontScale])

  function handleClear() {
    if (confirm('Clear the current thread? Snapshot it first if you want to keep it.')) {
      void clearThread()
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative z-10 text-foreground h-dvh flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-5 py-3 border-b shrink-0 pt-[max(0.75rem,env(safe-area-inset-top))] pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]">
          <h1 className="text-[15px] font-extrabold tracking-[-0.02em] select-none">RELAY</h1>
          <div className="flex items-center gap-1">
            {hasMessages && (
              <>
                <ExportMenu />
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
        <AboutDialog />
      </div>
    </TooltipProvider>
  )
}

export default App
