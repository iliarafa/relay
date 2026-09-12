import type { ProviderId, ReplyLength } from '@/lib/storage/db'

function providerLabel(p: ProviderId): string {
  return p === 'claude' ? 'Claude' : 'Grok'
}

// Cross-model turns are means to an end — keep them short and verdict-first so
// a debate reads as a scoreboard, not a stack of essays.
export const DEBATE_TURN_RULES =
  "Keep it under 150 words. Open with a one-sentence verdict, then at most three short bullets. No preamble, and don't restate the other side's points."

export const SYNTHESIZE_RULES =
  'Keep it under 200 words. Open with a one-sentence verdict, then give the improved answer.'

export const DEBATE_SYNTHESIS_RULES =
  'Be complete but tight — roughly 300 words unless the question genuinely needs more.'

export function synthesizePrompt(from: ProviderId, body: string): string {
  return `Here is what ${providerLabel(from)} said. Critique and synthesize. ${SYNTHESIZE_RULES}\n\n${body}`
}

export function debateOpenPrompt(from: ProviderId, body: string): string {
  return `Here is what ${providerLabel(from)} said. Challenge it: find weaknesses, correct errors, and add what's missing. Be substantive, not polite. ${DEBATE_TURN_RULES}\n\n${body}`
}

export function debateReplyPrompt(from: ProviderId): string {
  return `Respond to ${providerLabel(from)}'s critique above: defend what holds up, concede what doesn't, and improve the answer. ${DEBATE_TURN_RULES}`
}

export function debateSynthesisPrompt(): string {
  return `The debate is over. Write your final, best answer to the original question, incorporating the valid points raised on both sides. ${DEBATE_SYNTHESIS_RULES}`
}

export function lengthInstruction(replyLength: ReplyLength): string {
  if (replyLength === 'concise') {
    return 'Keep replies under about 150 words unless the user explicitly asks for detail. Lead with the answer; skip preamble and recaps.'
  }
  if (replyLength === 'detailed') {
    return 'Answer thoroughly; prefer completeness over brevity.'
  }
  return ''
}

// Joins the user's system prompt with the reply-length instruction. Returns ''
// when both are empty so providers keep omitting the system field.
export function composeSystemPrompt(userPrompt: string, replyLength: ReplyLength): string {
  const parts = [userPrompt.trim(), lengthInstruction(replyLength)].filter(Boolean)
  return parts.join('\n\n')
}
