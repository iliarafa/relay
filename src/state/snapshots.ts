import { create } from 'zustand'
import { db, type Snapshot, type ThreadMessage } from '@/lib/storage/db'
import { useThread } from '@/state/thread'

export interface SnapshotsState {
  hydrated: boolean
  snapshots: Snapshot[]
  hydrate: () => Promise<void>
  save: (name: string, messages: ThreadMessage[]) => Promise<Snapshot | null>
  load: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function cloneMessages(messages: ThreadMessage[]): ThreadMessage[] {
  return messages.map((m) => ({
    ...m,
    content: m.content.map((b) => ({ ...b })),
  }))
}

async function loadAll(): Promise<Snapshot[]> {
  return db.snapshots.orderBy('createdAt').reverse().toArray()
}

export const useSnapshots = create<SnapshotsState>((set, get) => ({
  hydrated: false,
  snapshots: [],

  async hydrate() {
    if (get().hydrated) return
    const snapshots = await loadAll()
    set({ hydrated: true, snapshots })
  },

  async save(name, messages) {
    const trimmed = name.trim()
    if (!trimmed || messages.length === 0) return null
    const snap: Snapshot = {
      id: newId(),
      name: trimmed,
      createdAt: Date.now(),
      messages: cloneMessages(messages),
    }
    await db.snapshots.put(snap)
    set({ snapshots: [snap, ...get().snapshots] })
    return snap
  },

  async load(id) {
    const snap = await db.snapshots.get(id)
    if (!snap) return
    await useThread.getState().loadFromSnapshot(snap.messages)
  },

  async remove(id) {
    await db.snapshots.delete(id)
    set({ snapshots: get().snapshots.filter((s) => s.id !== id) })
  },
}))
