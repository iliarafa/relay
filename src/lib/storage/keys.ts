import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

export interface KeyStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
}

const PREFIX = 'ai4me:secret:'

const localStorageKeyStore: KeyStore = {
  async get(key) {
    try {
      return localStorage.getItem(PREFIX + key)
    } catch {
      return null
    }
  },
  async set(key, value) {
    localStorage.setItem(PREFIX + key, value)
  },
  async delete(key) {
    localStorage.removeItem(PREFIX + key)
  },
}

const preferencesKeyStore: KeyStore = {
  async get(key) {
    const { value } = await Preferences.get({ key: PREFIX + key })
    return value
  },
  async set(key, value) {
    await Preferences.set({ key: PREFIX + key, value })
  },
  async delete(key) {
    await Preferences.remove({ key: PREFIX + key })
  },
}

export const keys: KeyStore = Capacitor.isNativePlatform()
  ? preferencesKeyStore
  : localStorageKeyStore

export const KEY_ANTHROPIC = 'anthropic_api_key'
export const KEY_XAI = 'xai_api_key'
