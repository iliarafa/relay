import { create } from 'zustand'
import {
  SETTINGS_DEFAULTS,
  loadSettings,
  saveSettings,
  type ProviderId,
  type ReplyLength,
  type SettingsRow,
  type Theme,
} from '@/lib/storage/db'
import { KEY_ANTHROPIC, KEY_XAI, keys } from '@/lib/storage/keys'

export interface SettingsState {
  hydrated: boolean
  anthropicKey: string
  xaiKey: string
  claudeModel: string
  grokModel: string
  systemPrompt: string
  thinkingOn: boolean
  debateRounds: number
  replyLength: ReplyLength
  fontScale: number
  theme: Theme
  lastUsedModel: ProviderId

  hydrate: () => Promise<void>
  setApiKey: (provider: 'anthropic' | 'xai', value: string) => Promise<void>
  updateSettings: (patch: Partial<Omit<SettingsRow, 'id'>>) => Promise<void>
  setLastUsedModel: (model: ProviderId) => Promise<void>
}

export const useSettings = create<SettingsState>((set, get) => ({
  hydrated: false,
  anthropicKey: '',
  xaiKey: '',
  claudeModel: SETTINGS_DEFAULTS.claudeModel,
  grokModel: SETTINGS_DEFAULTS.grokModel,
  systemPrompt: SETTINGS_DEFAULTS.systemPrompt,
  thinkingOn: SETTINGS_DEFAULTS.thinkingOn,
  debateRounds: SETTINGS_DEFAULTS.debateRounds,
  replyLength: SETTINGS_DEFAULTS.replyLength,
  fontScale: SETTINGS_DEFAULTS.fontScale,
  theme: SETTINGS_DEFAULTS.theme,
  lastUsedModel: SETTINGS_DEFAULTS.lastUsedModel,

  async hydrate() {
    if (get().hydrated) return
    const [row, anthropicKey, xaiKey] = await Promise.all([
      loadSettings(),
      keys.get(KEY_ANTHROPIC),
      keys.get(KEY_XAI),
    ])
    set({
      hydrated: true,
      anthropicKey: anthropicKey ?? '',
      xaiKey: xaiKey ?? '',
      claudeModel: row.claudeModel,
      grokModel: row.grokModel,
      systemPrompt: row.systemPrompt,
      thinkingOn: row.thinkingOn,
      debateRounds: row.debateRounds,
      replyLength: row.replyLength,
      fontScale: row.fontScale,
      theme: row.theme,
      lastUsedModel: row.lastUsedModel,
    })
  },

  async setApiKey(provider, value) {
    const trimmed = value.trim()
    const storageKey = provider === 'anthropic' ? KEY_ANTHROPIC : KEY_XAI
    if (trimmed) {
      await keys.set(storageKey, trimmed)
    } else {
      await keys.delete(storageKey)
    }
    set(provider === 'anthropic' ? { anthropicKey: trimmed } : { xaiKey: trimmed })
  },

  async updateSettings(patch) {
    set(patch)
    await saveSettings(patch)
  },

  async setLastUsedModel(model) {
    set({ lastUsedModel: model })
    await saveSettings({ lastUsedModel: model })
  },
}))
