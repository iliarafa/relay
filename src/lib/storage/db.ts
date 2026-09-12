import Dexie, { type EntityTable } from 'dexie'

export type Theme = 'light' | 'dark' | 'system'
export type ProviderId = 'claude' | 'grok'

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; mediaType: string; data: string }

export interface SettingsRow {
  id: 1
  claudeModel: string
  grokModel: string
  systemPrompt: string
  thinkingOn: boolean
  debateRounds: number
  fontScale: number
  theme: Theme
  lastUsedModel: ProviderId
}

export interface ThreadMessage {
  id: string
  role: 'user' | 'assistant'
  provider?: ProviderId
  content: ContentBlock[]
  thinking?: string
  model?: string
  origin?: { kind: 'relay' | 'synthesize' | 'debate' | 'debate-synthesis'; from: ProviderId }
  createdAt: number
}

export interface Snapshot {
  id: string
  name: string
  createdAt: number
  messages: ThreadMessage[]
}

export async function loadThread(): Promise<ThreadMessage[]> {
  return db.thread.orderBy('createdAt').toArray()
}

export async function persistThread(messages: ThreadMessage[]): Promise<void> {
  await db.transaction('rw', db.thread, async () => {
    await db.thread.clear()
    if (messages.length > 0) await db.thread.bulkPut(messages)
  })
}

export const db = new Dexie('ai4me') as Dexie & {
  settings: EntityTable<SettingsRow, 'id'>
  thread: EntityTable<ThreadMessage, 'id'>
  snapshots: EntityTable<Snapshot, 'id'>
}

db.version(1).stores({
  settings: 'id',
  thread: 'id, createdAt',
  snapshots: 'id, createdAt, name',
})

export const SETTINGS_DEFAULTS: SettingsRow = {
  id: 1,
  claudeModel: 'claude-fable-5',
  grokModel: 'grok-4.6',
  systemPrompt: '',
  thinkingOn: true,
  debateRounds: 3,
  fontScale: 1,
  theme: 'system',
  lastUsedModel: 'claude',
}

export async function loadSettings(): Promise<SettingsRow> {
  const row = await db.settings.get(1)
  if (!row) return SETTINGS_DEFAULTS
  const merged = { ...SETTINGS_DEFAULTS, ...row, id: 1 as const }
  // Stored copy of the old shipped default — map forward so existing installs
  // stop targeting a model whose request shape we no longer send. Custom
  // model strings are untouched. Read-time only; next Save persists it.
  if (merged.claudeModel === 'claude-opus-4-7') {
    merged.claudeModel = 'claude-opus-5'
  }
  if (merged.grokModel === 'grok-4-latest') {
    merged.grokModel = 'grok-4.6'
  }
  return merged
}

export async function saveSettings(patch: Partial<Omit<SettingsRow, 'id'>>): Promise<void> {
  const current = await loadSettings()
  await db.settings.put({ ...current, ...patch, id: 1 })
}
