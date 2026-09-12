import type { ProviderId } from '@/lib/storage/db'

export const CLAUDE_FABLE_ID = 'claude-fable-5'
export const CLAUDE_OPUS_ID = 'claude-opus-5'
export const GROK_46_ID = 'grok-4.6'

export const CLAUDE_MODELS = [
  { id: CLAUDE_FABLE_ID, label: 'Fable' },
  { id: CLAUDE_OPUS_ID, label: 'Opus' },
] as const

export const GROK_MODELS = [{ id: GROK_46_ID, label: 'Grok 4.6' }] as const

export type ComposerModel = 'fable' | 'opus' | 'grok'

export function isFableModel(model: string): boolean {
  return model.startsWith('claude-fable')
}

export function composerFromState(
  provider: ProviderId,
  claudeModel: string,
): ComposerModel {
  if (provider === 'grok') return 'grok'
  if (isFableModel(claudeModel)) return 'fable'
  return 'opus'
}

export function modelIdForComposer(choice: ComposerModel): string {
  if (choice === 'fable') return CLAUDE_FABLE_ID
  if (choice === 'opus') return CLAUDE_OPUS_ID
  return GROK_46_ID
}

export function modelLabel(model?: string, provider?: ProviderId): string {
  if (model && isFableModel(model)) return 'Fable'
  if (model?.startsWith('claude-opus')) return 'Opus'
  if (model?.startsWith('grok')) return 'Grok'
  if (provider === 'claude') return 'Claude'
  if (provider === 'grok') return 'Grok'
  return ''
}
