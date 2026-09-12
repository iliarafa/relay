export type KeyProvider = 'anthropic' | 'xai'

export const KEY_PREFIX: Record<KeyProvider, string> = {
  anthropic: 'sk-ant-',
  xai: 'xai-',
}

const PATTERN: Record<KeyProvider, RegExp> = {
  anthropic: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
  xai: /^xai-[A-Za-z0-9_-]{20,}$/,
}

/** Shape check only — the provider has the final word (see providers/verify.ts). */
export function keyLooksValid(provider: KeyProvider, key: string): boolean {
  return PATTERN[provider].test(key.trim())
}

/** `sk-ant-…3f9a` — enough to recognise a key, never enough to use it. */
export function maskKey(provider: KeyProvider, key: string): string {
  const k = key.trim()
  const prefix = KEY_PREFIX[provider]
  const tail = k.length > prefix.length + 4 ? k.slice(-4) : ''
  return `${prefix}…${tail}`
}
