import { streamAnthropic } from './anthropic'
import { streamXai } from './xai'
import type { ProviderId, StreamEvent, StreamRequest } from './types'

export async function* streamProvider(
  provider: ProviderId,
  request: StreamRequest,
): AsyncGenerator<StreamEvent> {
  const fn = provider === 'claude' ? streamAnthropic : streamXai
  yield* fn(request)
}

export type { ProviderId, StreamEvent, StreamRequest }
export { ProviderError } from './types'
export type { ContentBlock, ProviderMessage } from './types'
