import type { KeyProvider } from '@/lib/apiKeys'

export type KeyVerdict = 'ok' | 'rejected' | 'unreachable'

const MODELS_ENDPOINT: Record<KeyProvider, string> = {
  anthropic: 'https://api.anthropic.com/v1/models',
  xai: 'https://api.x.ai/v1/models',
}

function headersFor(provider: KeyProvider, key: string): Record<string, string> {
  if (provider === 'anthropic') {
    return {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    }
  }
  return { authorization: `Bearer ${key}` }
}

/**
 * Checks a key against the provider's free models listing. 2xx → ok;
 * 401/403 → rejected; xAI reports a bad key as 400 "Incorrect API key
 * provided", so a 400 whose body mentions the key is rejected too. Anything
 * else (network, CORS, 5xx) → unreachable, so a good key is never shown as
 * bad because of a flaky connection.
 */
export async function verifyApiKey(
  provider: KeyProvider,
  key: string,
  signal?: AbortSignal,
): Promise<KeyVerdict> {
  try {
    const res = await fetch(MODELS_ENDPOINT[provider], {
      method: 'GET',
      headers: headersFor(provider, key.trim()),
      signal,
    })
    if (res.ok) return 'ok'
    if (res.status === 401 || res.status === 403) return 'rejected'
    if (res.status === 400) {
      const body = await res.text().catch(() => '')
      if (/api[ _-]?key/i.test(body)) return 'rejected'
    }
    return 'unreachable'
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    return 'unreachable'
  }
}
