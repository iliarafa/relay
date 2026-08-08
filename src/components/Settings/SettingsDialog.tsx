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
import { useSettings } from '@/state/settings'
import type { Theme } from '@/lib/storage/db'

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
    setTheme(settings.theme)
  }, [open, settings])

  async function handleSave() {
    setSaving(true)
    try {
      await Promise.all([
        settings.setApiKey('anthropic', anthropicKey),
        settings.setApiKey('xai', xaiKey),
        settings.updateSettings({
          claudeModel: claudeModel.trim() || 'claude-opus-5',
          grokModel: grokModel.trim() || 'grok-4-latest',
          systemPrompt,
          thinkingOn,
          debateRounds:
            Number.isFinite(debateRounds) && debateRounds >= 1
              ? Math.min(Math.floor(debateRounds), 10)
              : 3,
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            API keys stay on this device. Models, prompt, and preferences persist locally.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          <section className="grid gap-3">
            <h3 className="text-sm font-medium text-muted-foreground">API keys</h3>
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
            <h3 className="text-sm font-medium text-muted-foreground">Models</h3>
            <div className="grid gap-2">
              <Label htmlFor="claude-model">Claude model ID</Label>
              <Input
                id="claude-model"
                spellCheck={false}
                value={claudeModel}
                onChange={(e) => setClaudeModel(e.target.value)}
                placeholder="claude-opus-5"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="grok-model">Grok model ID</Label>
              <Input
                id="grok-model"
                spellCheck={false}
                value={grokModel}
                onChange={(e) => setGrokModel(e.target.value)}
                placeholder="grok-4-latest"
              />
            </div>
          </section>

          <Separator />

          <section className="grid gap-3">
            <h3 className="text-sm font-medium text-muted-foreground">Behavior</h3>
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
            <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2">
              <div className="grid gap-0.5">
                <Label htmlFor="thinking-on" className="cursor-pointer">
                  Extended thinking (Claude)
                </Label>
                <span className="text-xs text-muted-foreground">
                  Claude thinks adaptively before answering.
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
            <h3 className="text-sm font-medium text-muted-foreground">Appearance</h3>
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
