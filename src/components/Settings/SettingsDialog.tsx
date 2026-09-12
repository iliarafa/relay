import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { useSettings } from '@/state/settings'
import { applyFontScale } from '@/lib/theme'
import {
  CLAUDE_FABLE_ID,
  CLAUDE_MODELS,
  GROK_46_ID,
  GROK_MODELS,
} from '@/lib/models'
import type { ReplyLength, Theme } from '@/lib/storage/db'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: Props) {
  const settings = useSettings()

  const [anthropicKey, setAnthropicKey] = useState(settings.anthropicKey)
  const [xaiKey, setXaiKey] = useState(settings.xaiKey)
  const [claudeModel, setClaudeModel] = useState(settings.claudeModel)
  const [grokModel, setGrokModel] = useState(settings.grokModel)
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt)
  const [thinkingOn, setThinkingOn] = useState(settings.thinkingOn)
  const [debateRounds, setDebateRounds] = useState(settings.debateRounds)
  const [replyLength, setReplyLength] = useState<ReplyLength>(settings.replyLength)
  const [fontScale, setFontScale] = useState(settings.fontScale)
  const [theme, setTheme] = useState<Theme>(settings.theme)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setAnthropicKey(settings.anthropicKey)
    setXaiKey(settings.xaiKey)
    setClaudeModel(settings.claudeModel)
    setGrokModel(settings.grokModel)
    setSystemPrompt(settings.systemPrompt)
    setThinkingOn(settings.thinkingOn)
    setDebateRounds(settings.debateRounds)
    setReplyLength(settings.replyLength)
    setFontScale(settings.fontScale)
    setTheme(settings.theme)
  }, [open, settings])

  useEffect(() => {
    if (!open) return
    applyFontScale(fontScale)
  }, [open, fontScale])

  useEffect(() => {
    if (open) return
    applyFontScale(useSettings.getState().fontScale)
  }, [open])

  async function handleSave() {
    setSaving(true)
    try {
      await Promise.all([
        settings.setApiKey('anthropic', anthropicKey),
        settings.setApiKey('xai', xaiKey),
        settings.updateSettings({
          claudeModel: claudeModel.trim() || CLAUDE_FABLE_ID,
          grokModel: grokModel.trim() || GROK_46_ID,
          systemPrompt,
          thinkingOn,
          debateRounds:
            Number.isFinite(debateRounds) && debateRounds >= 1
              ? Math.min(Math.floor(debateRounds), 10)
              : 3,
          replyLength,
          fontScale:
            Number.isFinite(fontScale)
              ? Math.min(Math.max(fontScale, 0.85), 1.3)
              : 1,
          theme,
        }),
      ])
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] max-w-lg grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader>
          <DialogTitle className="label text-foreground">Settings</DialogTitle>
          <DialogDescription>
            API keys stay on this device. Models, prompt, and preferences persist locally.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 overflow-y-auto py-2">
          <section className="grid gap-3">
            <h3 className="label">API keys</h3>
            <div className="grid gap-2">
              <Label htmlFor="anthropic-key">Anthropic API key</Label>
              <Input
                id="anthropic-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-ant-..."
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="xai-key">xAI API key</Label>
              <Input
                id="xai-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="xai-..."
                value={xaiKey}
                onChange={(e) => setXaiKey(e.target.value)}
              />
            </div>
          </section>

          <Separator />

          <section className="grid gap-3">
            <h3 className="label">Models</h3>
            <div className="grid gap-2">
              <Label htmlFor="claude-model">Claude</Label>
              <Select value={claudeModel} onValueChange={setClaudeModel}>
                <SelectTrigger id="claude-model" className="w-full">
                  <SelectValue placeholder="Choose a Claude model" />
                </SelectTrigger>
                <SelectContent>
                  {CLAUDE_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                  {claudeModel &&
                    !CLAUDE_MODELS.some((m) => m.id === claudeModel) && (
                      <SelectItem value={claudeModel}>{claudeModel}</SelectItem>
                    )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="grok-model">Grok</Label>
              <Select value={grokModel} onValueChange={setGrokModel}>
                <SelectTrigger id="grok-model" className="w-full">
                  <SelectValue placeholder="Choose a Grok model" />
                </SelectTrigger>
                <SelectContent>
                  {GROK_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                  {grokModel && !GROK_MODELS.some((m) => m.id === grokModel) && (
                    <SelectItem value={grokModel}>{grokModel}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </section>

          <Separator />

          <section className="grid gap-3">
            <h3 className="label">Behavior</h3>
            <div className="grid gap-2">
              <Label htmlFor="system-prompt">System prompt</Label>
              <Textarea
                id="system-prompt"
                rows={4}
                placeholder="Empty by default. Sent on both providers when set."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reply-length">Reply length</Label>
              <Select value={replyLength} onValueChange={(v) => setReplyLength(v as ReplyLength)}>
                <SelectTrigger id="reply-length" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="concise">Concise</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="detailed">Detailed</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                Applies to every turn. Debate exchanges are always kept short.
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-[2px] border px-3 py-2">
              <div className="grid gap-0.5">
                <Label htmlFor="thinking-on" className="cursor-pointer">
                  Extended thinking (Opus)
                </Label>
                <span className="text-xs text-muted-foreground">
                  Opus thinks adaptively when on. Fable always thinks.
                </span>
              </div>
              <Switch id="thinking-on" checked={thinkingOn} onCheckedChange={setThinkingOn} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="debate-rounds">Debate rounds</Label>
              <Input
                id="debate-rounds"
                type="number"
                min={1}
                max={10}
                step={1}
                value={debateRounds}
                onChange={(e) => setDebateRounds(Number(e.target.value))}
              />
              <span className="text-xs text-muted-foreground">
                Exchanges per debate before the closing synthesis.
              </span>
            </div>
          </section>

          <Separator />

          <section className="grid gap-3">
            <h3 className="label">Appearance</h3>
            <div className="grid gap-2">
              <Label htmlFor="theme">Theme</Label>
              <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
                <SelectTrigger id="theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="font-scale">Font size · {Math.round(fontScale * 100)}%</Label>
              <Slider
                id="font-scale"
                min={0.85}
                max={1.3}
                step={0.05}
                value={[fontScale]}
                onValueChange={([v]) => setFontScale(Math.round(v * 100) / 100)}
              />
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
