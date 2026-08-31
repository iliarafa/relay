import { useState } from 'react'
import { Check, Copy, Download, FileCode2, FileText, FileType } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  exportHtmlFile,
  exportMarkdownFile,
  exportPdfFile,
} from '@/lib/export/download'
import { threadToMarkdown } from '@/lib/threadMarkdown'
import { useThread } from '@/state/thread'

export function ExportMenu() {
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleCopy() {
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

  function handleMarkdown() {
    const messages = useThread.getState().messages
    if (messages.length === 0) return
    exportMarkdownFile(messages)
  }

  function handleHtml() {
    const messages = useThread.getState().messages
    if (messages.length === 0) return
    exportHtmlFile(messages)
  }

  async function handlePdf() {
    const messages = useThread.getState().messages
    if (messages.length === 0 || busy) return
    setBusy(true)
    try {
      await exportPdfFile(messages)
    } catch (e) {
      console.error('pdf export failed', e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Export thread" disabled={busy}>
          {copied ? <Check className="size-4" /> : <Download className="size-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => void handleCopy()}>
          <Copy />
          Copy markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleMarkdown}>
          <FileText />
          Download Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleHtml}>
          <FileCode2 />
          Download HTML
        </DropdownMenuItem>
        <DropdownMenuItem disabled={busy} onClick={() => void handlePdf()}>
          <FileType />
          {busy ? 'Preparing PDF…' : 'Download PDF'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
