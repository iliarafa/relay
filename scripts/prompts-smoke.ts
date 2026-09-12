import type { ThreadMessage } from '@/lib/storage/db'
import {
  DEBATE_TURN_RULES,
  composeSystemPrompt,
  debateOpenPrompt,
  debateReplyPrompt,
  debateSynthesisPrompt,
  lengthInstruction,
  mergePrompt,
  synthesizePrompt,
} from '@/lib/prompts'
import {
  firstParagraph,
  firstSentence,
  isDebatePrompt,
  isDebateTurn,
  lastSpokenBody,
  shouldCollapseDebateTurn,
} from '@/lib/messageText'

function eq(label: string, got: unknown, want: unknown) {
  const a = JSON.stringify(got)
  const b = JSON.stringify(want)
  if (a === b) console.log(`ok  ${label}`)
  else {
    console.error(`FAIL ${label}\n  got:  ${a}\n  want: ${b}`)
    process.exitCode = 1
  }
}

function has(label: string, haystack: string, needle: string) {
  if (haystack.includes(needle)) console.log(`ok  ${label}`)
  else {
    console.error(`FAIL ${label}\n  missing: ${JSON.stringify(needle)}`)
    process.exitCode = 1
  }
}

function lacks(label: string, haystack: string, needle: string) {
  if (!haystack.includes(needle)) console.log(`ok  ${label}`)
  else {
    console.error(`FAIL ${label}\n  should not contain: ${JSON.stringify(needle)}`)
    process.exitCode = 1
  }
}

// --- system prompt composition
eq('standard + empty → no system prompt', composeSystemPrompt('', 'standard'), '')
eq('standard keeps user prompt verbatim', composeSystemPrompt('Be kind.', 'standard'), 'Be kind.')
has('concise instruction mentions 150 words', lengthInstruction('concise'), '150 words')
eq(
  'user prompt + concise joined by blank line',
  composeSystemPrompt('Be kind.', 'concise'),
  `Be kind.\n\n${lengthInstruction('concise')}`,
)
eq('detailed alone', composeSystemPrompt('  ', 'detailed'), lengthInstruction('detailed'))

// --- cross-model prompts
const body = 'The sky is green.'
has('debate opener carries source body', debateOpenPrompt('claude', body), body)
has('debate opener has turn rules', debateOpenPrompt('claude', body), DEBATE_TURN_RULES)
has('debate reply has turn rules', debateReplyPrompt('grok'), DEBATE_TURN_RULES)
has('debate reply names the critic', debateReplyPrompt('grok'), "Grok's critique")
lacks('synthesis is not capped at 150', debateSynthesisPrompt(), '150 words')
has('synthesis has soft cap', debateSynthesisPrompt(), '300 words')
has('synthesize carries body', synthesizePrompt('grok', body), body)
has('synthesize is capped', synthesizePrompt('grok', body), '200 words')
const merged = mergePrompt('grok', 'Grok view.', 'claude', 'Claude view.')
has('merge quotes the other model', merged, 'Grok said:\n\nGrok view.')
has('merge quotes own earlier answer', merged, 'you (Claude) said earlier:\n\nClaude view.')
has('merge asks for best of both', merged, 'best of both')
has('merge is capped', merged, '250 words')
lacks('merge does not use the critique framing', merged, 'Critique and synthesize')

// --- text helpers
eq('firstParagraph single', firstParagraph('Just one paragraph.'), {
  preview: 'Just one paragraph.',
  truncated: false,
})
eq('firstParagraph multi', firstParagraph('First para.\n\nSecond para.\n\nThird.'), {
  preview: 'First para.',
  truncated: true,
})
eq('firstParagraph tolerates whitespace-only blank line', firstParagraph('A\n  \nB'), {
  preview: 'A',
  truncated: true,
})
eq('firstSentence plain', firstSentence('Grok is wrong here. The rest follows.'), 'Grok is wrong here.')
eq('firstSentence strips Verdict label', firstSentence('**Verdict:** Mostly right, one error. More.'), 'Mostly right, one error.')
eq('firstSentence strips bullet', firstSentence('- Disagree on point two! Details.'), 'Disagree on point two!')
eq('firstSentence stops at newline', firstSentence('Agreed\nMore text.'), 'Agreed')
eq('firstSentence unbolds other labels', firstSentence('**Claude** concedes. Next.'), 'Claude concedes.')
eq('firstSentence strips numbered list', firstSentence('1. Point one. Point two.'), 'Point one.')

// --- debate structure
function msg(partial: Partial<ThreadMessage> & Pick<ThreadMessage, 'role'>): ThreadMessage {
  return {
    id: Math.random().toString(36).slice(2),
    content: [{ type: 'text', text: partial.content ? '' : 'body' }],
    createdAt: 0,
    ...partial,
  }
}
const thread: ThreadMessage[] = [
  msg({ role: 'user' }),
  msg({ role: 'assistant', provider: 'claude' }),
  msg({ role: 'user', origin: { kind: 'debate', from: 'claude' } }),
  msg({ role: 'assistant', provider: 'grok' }),
  msg({ role: 'user', origin: { kind: 'debate', from: 'grok' } }),
  msg({ role: 'assistant', provider: 'claude', content: [] }),
  msg({ role: 'user', origin: { kind: 'debate-synthesis', from: 'grok' } }),
  msg({ role: 'assistant', provider: 'claude' }),
]
eq('first message is not a debate turn', isDebateTurn(thread, 0), false)
eq('lastSpokenBody: claude spoke before grok turn', lastSpokenBody(thread, 'claude', 3), 'body')
eq('lastSpokenBody: grok has not spoken before claude turn', lastSpokenBody(thread, 'grok', 1), null)
eq('lastSpokenBody: skips empty placeholder', lastSpokenBody(thread.slice(0, 6), 'claude', 6), 'body')
eq('lastSpokenBody: nothing before index 0', lastSpokenBody(thread, 'claude', 0), null)
eq('plain answer is not a debate turn', isDebateTurn(thread, 1), false)
eq('reply to debate prompt is a debate turn', isDebateTurn(thread, 3), true)
eq('synthesis reply is not a debate turn', isDebateTurn(thread, 7), false)
eq('debate prompt detected', isDebatePrompt(thread[2]), true)
eq('synthesis prompt detected', isDebatePrompt(thread[6]), true)
eq('plain user message is not a debate prompt', isDebatePrompt(thread[0]), false)
eq('folds when a later reply has text', shouldCollapseDebateTurn(thread, 3), true)
eq('streaming placeholder at end never folds', shouldCollapseDebateTurn(thread.slice(0, 6), 5), false)
eq(
  'last finished turn stays open while next is empty',
  shouldCollapseDebateTurn(thread.slice(0, 6), 3),
  false,
)
