import { parseSSEStream } from '../src/lib/sse.ts'

function streamFromString(s: string): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  const chunks = s.match(/.{1,17}/gs) ?? [s]
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c))
      controller.close()
    },
  })
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const out: Array<{ event?: string; data: string }> = []
  for await (const e of parseSSEStream(stream)) out.push(e)
  return out
}

function eq(label: string, got: unknown, want: unknown) {
  const a = JSON.stringify(got)
  const b = JSON.stringify(want)
  if (a === b) {
    console.log(`ok  ${label}`)
  } else {
    console.error(`FAIL ${label}\n  got:  ${a}\n  want: ${b}`)
    process.exitCode = 1
  }
}

async function run() {
  eq(
    'simple text-only event',
    await collect(streamFromString('data: hello\n\n')),
    [{ data: 'hello' }],
  )

  eq(
    'event + data',
    await collect(streamFromString('event: foo\ndata: bar\n\n')),
    [{ event: 'foo', data: 'bar' }],
  )

  eq(
    'multiple events',
    await collect(streamFromString('data: one\n\ndata: two\n\ndata: three\n\n')),
    [{ data: 'one' }, { data: 'two' }, { data: 'three' }],
  )

  eq(
    'multi-line data',
    await collect(streamFromString('data: line1\ndata: line2\n\n')),
    [{ data: 'line1\nline2' }],
  )

  eq(
    'CRLF line endings',
    await collect(streamFromString('event: x\r\ndata: y\r\n\r\n')),
    [{ event: 'x', data: 'y' }],
  )

  eq(
    'comment lines ignored',
    await collect(streamFromString(': keepalive\ndata: ok\n\n')),
    [{ data: 'ok' }],
  )

  eq(
    'OpenAI-style [DONE]',
    await collect(streamFromString('data: {"a":1}\n\ndata: [DONE]\n\n')),
    [{ data: '{"a":1}' }, { data: '[DONE]' }],
  )

  eq(
    'split across chunks (handled by chunking pattern)',
    await collect(streamFromString('data: alpha\n\nevent: msg\ndata: {"x":2}\n\n')),
    [{ data: 'alpha' }, { event: 'msg', data: '{"x":2}' }],
  )
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
