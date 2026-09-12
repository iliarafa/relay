import { buildAnthropicRequest, streamAnthropic } from '../src/lib/providers/anthropic.ts'
import { streamXai } from '../src/lib/providers/xai.ts'
import type { StreamEvent } from '../src/lib/providers/types.ts'

function fakeFetch(body: string, status = 200) {
  return async () => {
    return new Response(
      new ReadableStream({
        start(controller) {
          const enc = new TextEncoder()
          for (const chunk of body.match(/.{1,40}/gs) ?? [body]) {
            controller.enqueue(enc.encode(chunk))
          }
          controller.close()
        },
      }),
      { status, headers: { 'content-type': 'text/event-stream' } },
    )
  }
}

async function collect(gen: AsyncGenerator<StreamEvent>) {
  const out: StreamEvent[] = []
  for await (const e of gen) out.push(e)
  return out
}

function eq(label: string, got: unknown, want: unknown) {
  const a = JSON.stringify(got)
  const b = JSON.stringify(want)
  if (a === b) console.log(`ok  ${label}`)
  else {
    console.error(`FAIL ${label}\n  got:  ${a}\n  want: ${b}`)
    process.exitCode = 1
  }
}

const originalFetch = globalThis.fetch

async function withFakeFetch(body: string, fn: () => Promise<unknown>) {
  globalThis.fetch = fakeFetch(body) as unknown as typeof fetch
  try {
    return await fn()
  } finally {
    globalThis.fetch = originalFetch
  }
}

async function run() {
  // Anthropic: text + thinking deltas + tool start, terminated by message_stop
  const anthropicSse = [
    'event: message_start',
    'data: {"type":"message_start","message":{"id":"msg_1"}}',
    '',
    'event: content_block_start',
    'data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking"}}',
    '',
    'event: content_block_delta',
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"Hmm "}}',
    '',
    'event: content_block_delta',
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"OK."}}',
    '',
    'event: content_block_stop',
    'data: {"type":"content_block_stop","index":0}',
    '',
    'event: content_block_start',
    'data: {"type":"content_block_start","index":1,"content_block":{"type":"text"}}',
    '',
    'event: content_block_delta',
    'data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"Hello "}}',
    '',
    'event: content_block_delta',
    'data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"world"}}',
    '',
    'event: content_block_start',
    'data: {"type":"content_block_start","index":2,"content_block":{"type":"tool_use","name":"web_search"}}',
    '',
    'event: message_stop',
    'data: {"type":"message_stop"}',
    '',
  ].join('\n')

  await withFakeFetch(anthropicSse, async () => {
    const events = await collect(
      streamAnthropic({
        apiKey: 'k',
        model: 'claude-opus-4-7',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
        thinkingEnabled: true,
      }),
    )
    eq('anthropic events', events, [
      { type: 'thinking-delta', text: 'Hmm ' },
      { type: 'thinking-delta', text: 'OK.' },
      { type: 'text-delta', text: 'Hello ' },
      { type: 'text-delta', text: 'world' },
      { type: 'tool-start', tool: 'web_search' },
      { type: 'done' },
    ])
  })

  // xAI: reasoning_content + content + finish_reason
  const xaiSse = [
    'data: {"choices":[{"delta":{"reasoning_content":"think "}}]}',
    '',
    'data: {"choices":[{"delta":{"content":"Hi "}}]}',
    '',
    'data: {"choices":[{"delta":{"content":"there"}}]}',
    '',
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
    '',
    'data: [DONE]',
    '',
  ].join('\n')

  await withFakeFetch(xaiSse, async () => {
    const events = await collect(
      streamXai({
        apiKey: 'k',
        model: 'grok-4-latest',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      }),
    )
    eq('xai events', events, [
      { type: 'thinking-delta', text: 'think ' },
      { type: 'text-delta', text: 'Hi ' },
      { type: 'text-delta', text: 'there' },
      { type: 'done' },
    ])
  })

  // Anthropic: request body shape (current API — adaptive thinking, no budget_tokens)
  {
    const onBody = buildAnthropicRequest({
      apiKey: 'k',
      model: 'claude-opus-5',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      thinkingEnabled: true,
    })
    eq('anthropic request: adaptive thinking', onBody.thinking, {
      type: 'adaptive',
      display: 'summarized',
    })
    eq('anthropic request: max_tokens', onBody.max_tokens, 64000)

    const offBody = buildAnthropicRequest({
      apiKey: 'k',
      model: 'claude-opus-5',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      thinkingEnabled: false,
    })
    eq('anthropic request: thinking disabled', offBody.thinking, { type: 'disabled' })

    const searchBody = buildAnthropicRequest({
      apiKey: 'k',
      model: 'claude-opus-5',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      webSearchEnabled: true,
    })
    eq('anthropic request: web search tool', searchBody.tools, [
      { type: 'web_search_20260209', name: 'web_search' },
    ])

    const fableOn = buildAnthropicRequest({
      apiKey: 'k',
      model: 'claude-fable-5',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      thinkingEnabled: true,
    })
    eq('fable request: no thinking field', fableOn.thinking, undefined)

    const fableOff = buildAnthropicRequest({
      apiKey: 'k',
      model: 'claude-fable-5',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      thinkingEnabled: false,
    })
    eq('fable request: thinking omitted when off', fableOff.thinking, undefined)
  }

  // Anthropic: error response
  globalThis.fetch = (async () =>
    new Response('{"error":{"message":"bad key"}}', { status: 401 })) as unknown as typeof fetch
  try {
    let threw = false
    try {
      await collect(
        streamAnthropic({
          apiKey: 'k',
          model: 'claude-opus-4-7',
          messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
        }),
      )
    } catch (e) {
      threw = e instanceof Error && /401/.test(e.message)
    }
    eq('anthropic error throws ProviderError with status', threw, true)
  } finally {
    globalThis.fetch = originalFetch
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
