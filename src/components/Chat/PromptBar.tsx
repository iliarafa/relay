import { useRef, useState } from 'react'
import { ArrowUp, Globe, Paperclip, Square, X } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useThread } from '@/state/thread'
import { useSettings } from '@/state/settings'
import {
  CLAUDE_FABLE_ID,
  CLAUDE_OPUS_ID,
  composerFromState,
  type ComposerModel,
} from '@/lib/models'

interface AttachedImage {
  id: string
  mediaType: string
  data: string
  preview: string
  name: string
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}

async function fileToImage(file: File): Promise<AttachedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'))
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '')
      const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
      if (!match) {
        reject(new Error('Unsupported image encoding'))
        return
      }
      resolve({
        id: newId(),
        mediaType: match[1],
        data: match[2],
        preview: dataUrl,
        name: file.name,
      })
    }
    reader.readAsDataURL(file)
  })
}

export function PromptBar() {
  const [text, setText] = useState('')
  const [images, setImages] = useState<AttachedImage[]>([])
  const [webSearch, setWebSearch] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const isStreaming = useThread((s) => s.isStreaming)
  const isDebating = useThread((s) => s.isDebating)
  const currentModel = useThread((s) => s.currentModel)
  const send = useThread((s) => s.sendMessage)
  const cancel = useThread((s) => s.cancel)
  const setCurrentModel = useThread((s) => s.setCurrentModel)

  const anthropicKey = useSettings((s) => s.anthropicKey)
  const xaiKey = useSettings((s) => s.xaiKey)
  const claudeModel = useSettings((s) => s.claudeModel)
  const composer = composerFromState(currentModel, claudeModel)
  const hasKey = currentModel === 'claude' ? !!anthropicKey : !!xaiKey

  function setComposer(choice: ComposerModel) {
    if (choice === 'grok') {
      setCurrentModel('grok')
      return
    }
    setCurrentModel('claude')
    const next = choice === 'fable' ? CLAUDE_FABLE_ID : CLAUDE_OPUS_ID
    if (useSettings.getState().claudeModel !== next) {
      void useSettings.getState().updateSettings({ claudeModel: next })
    }
  }

  const composerLabel = composer === 'fable' ? 'Fable' : composer === 'opus' ? 'Opus' : 'Grok'

  const busy = isStreaming || isDebating

  const hasContent = text.trim().length > 0 || images.length > 0
  const canSend = !busy && hasKey && hasContent

  function submit() {
    if (!canSend) return
    const t = text
    const imgs = images.map((i) => ({ mediaType: i.mediaType, data: i.data }))
    const ws = webSearch
    setText('')
    setImages([])
    setWebSearch(false)
    void send(t, { images: imgs, webSearch: ws })
    requestAnimationFrame(() => taRef.current?.focus())
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (list.length === 0) return
    try {
      const loaded = await Promise.all(list.map(fileToImage))
      setImages((curr) => [...curr, ...loaded])
    } catch (e) {
      console.error('image load failed', e)
    }
  }

  async function pickFromCamera() {
    try {
      const photo = await Camera.getPhoto({
        source: CameraSource.Prompt,
        resultType: CameraResultType.Base64,
        quality: 90,
      })
      if (!photo.base64String) return
      const mediaType = `image/${photo.format || 'jpeg'}`
      setImages((curr) => [
        ...curr,
        {
          id: newId(),
          mediaType,
          data: photo.base64String!,
          preview: `data:${mediaType};base64,${photo.base64String}`,
          name: `photo.${photo.format || 'jpg'}`,
        },
      ])
    } catch (e) {
      // User cancelled or denied — silent
      console.debug('camera dismissed', e)
    }
  }

  function openAttach() {
    if (Capacitor.isNativePlatform()) {
      void pickFromCamera()
    } else {
      fileRef.current?.click()
    }
  }

  function removeImage(id: string) {
    setImages((curr) => curr.filter((i) => i.id !== id))
  }

  return (
    <div className="shrink-0 border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-3xl mx-auto px-4 py-3 flex flex-col gap-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((img) => (
              <div
                key={img.id}
                className="relative h-16 w-16 rounded-md overflow-hidden border bg-muted"
              >
                <img
                  src={img.preview}
                  alt={img.name}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  aria-label={`Remove ${img.name}`}
                  onClick={() => removeImage(img.id)}
                  className="absolute top-0.5 right-0.5 rounded-full bg-background/80 hover:bg-background p-0.5 text-foreground shadow-sm"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <Textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            hasKey
              ? `Message ${composerLabel}…  (⌘↵ to send)`
              : `Add an ${composer === 'grok' ? 'xAI' : 'Anthropic'} API key in Settings to use ${composerLabel}.`
          }
          rows={2}
          className="resize-none max-h-40"
        />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void handleFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Attach image"
                  disabled={busy}
                  onClick={openAttach}
                >
                  <Paperclip className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Attach image</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Toggle web search"
                  aria-pressed={webSearch}
                  disabled={busy}
                  onClick={() => setWebSearch((v) => !v)}
                  className={
                    webSearch
                      ? 'text-purple-500 ring-1 ring-purple-500 hover:text-purple-500'
                      : ''
                  }
                >
                  <Globe className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {webSearch ? 'Web search on' : 'Web search off'}
              </TooltipContent>
            </Tooltip>
            <Select
              value={composer}
              onValueChange={(v) => setComposer(v as ComposerModel)}
              disabled={busy}
            >
              <SelectTrigger size="sm" aria-label="Model" className="min-w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fable">Fable</SelectItem>
                <SelectItem value="opus">Opus</SelectItem>
                <SelectItem value="grok">Grok 4.6</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {busy ? (
            <Button onClick={cancel} variant="outline" size="sm">
              <Square className="size-3.5" /> Stop
            </Button>
          ) : (
            <Button onClick={submit} disabled={!canSend} size="sm">
              <ArrowUp className="size-4" /> Send
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
