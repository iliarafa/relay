# Debate mode + Claude API modernization — design

**Date:** 2026-08-08
**Status:** Approved by Ilias (both work items)
**Scope:** Two work items shipped together: (1) auto-relay "debate" between Claude and Grok, (2) repair of the Claude request shape for current Anthropic models.

## Context

Relay (repo `ai4me`) is a personal client for Claude + Grok: single rolling thread, per-message model picker, manual **Relay** and **Synthesize** actions on assistant messages. Auto-relay / debate was explicitly deferred to v2 in the original spec. This design brings it in as an opt-in, per-message action.

Separately, the app's Claude requests send `thinking: { type: 'enabled', budget_tokens }`, which the Anthropic API removed in the `claude-opus-4-7` generation — those requests now return 400 whenever thinking is on (the shipped default). Debate depends on working Claude requests, so both items ship together.

## Decisions (settled by interview — do not relitigate)

- **Trigger:** a button on completed assistant messages (next to Relay/Synthesize). No prompt-bar toggle, no always-on mode.
- **Stop rule:** fixed number of exchanges (setting `debateRounds`, default 3) + the Stop button works throughout, including between turns.
- **Turn framing:** adversarial critique — each exchange challenges the previous answer. Not raw relay, not critique-then-improve.
- **Ending:** one closing synthesis turn by the model whose answer started the debate.
- **Architecture:** debate loop lives in the thread store (`debateMessage` action), following the existing relay/synthesize pattern. No separate store, no generic auto-chain abstraction.

## Work item 1 — Debate mode

### Data model (`src/lib/storage/db.ts`)

- `ThreadMessage.origin.kind` union extends from `'relay' | 'synthesize'` to `'relay' | 'synthesize' | 'debate' | 'debate-synthesis'`. Additive optional field — no `db.version()` bump (same precedent as Phase 5).
- `SettingsRow` gains `debateRounds: number`. `SETTINGS_DEFAULTS.debateRounds = 3`. `loadSettings()` already merges defaults under the stored row, so existing installs pick up the default with no migration.

### Semantics

A debate on source message S (assistant, provider P, other provider Q):

1. **Exchange 1** — target Q. Synthetic user message quotes S's text (self-contained, mirroring `synthesizePrompt`):
   `Here is what ${label(P)} said. Challenge it: find weaknesses, correct errors, and add what's missing. Be substantive, not polite.\n\n${body}`
   `origin: { kind: 'debate', from: P }`.
2. **Exchanges 2..N** — alternate targets (P, Q, P, …). Synthetic user message is instruction-only, no quote — `toProviderMessages` already presents the full thread to each model with cross-provider turns attributed as `[Claude said:] …`:
   `Respond to ${label(other)}'s critique above: defend what holds up, concede what doesn't, and improve the answer.`
   `origin: { kind: 'debate', from: <provider being responded to> }`.
3. **Synthesis** — target P (the original answerer):
   `The debate is over. Write your final, best answer to the original question, incorporating the valid points raised on both sides.`
   `origin: { kind: 'debate-synthesis', from: Q }`.

`debateRounds` counts the exchanges (step 1 + step 2 turns). Total API calls per debate = `debateRounds + 1`. Rounds are clamped to ≥ 1.

Debate turns do not enable web search (same per-message rule as relay/synthesize). `lastUsedModel` is not touched (same rule as relay/synthesize).

### Orchestration (`src/state/thread.ts`)

- New state: `isDebating: boolean` (init `false`).
- New action `debateMessage(id: string)`:
  - Guards: return early if `isStreaming` or `isDebating`; source must exist, be `role === 'assistant'` with a `provider` and non-empty `textOf(source)`; **both** providers' API keys must be present (set `errorMessage` naming the missing one, same style as relay).
  - Sets `isDebating: true`, then loops the exchanges + synthesis. Each turn: build synthetic user message + assistant placeholder (provider = turn target), `set` + `persistThread`, then `await runStream(...)` — reusing the existing private helper unchanged (it handles streaming, abort, empty-placeholder trimming, persistence, `errorMessage`).
  - Between turns, bail out if `!get().isDebating` (cancelled) or `get().errorMessage !== null` (turn failed). Completed turns stay; no synthesis after a bail.
  - `finally`: set `isDebating: false`.
- `cancel()` additionally sets `isDebating: false` (before aborting, so the loop can't start another turn).
- `clear()` and `loadFromSnapshot()` also set `isDebating: false`.
- The early-return guards in `sendMessage`, `relayMessage`, and `synthesizeMessage` extend from `isStreaming` to `isStreaming || isDebating` — between debate turns `isStreaming` is briefly false, and nothing else may start a stream in that window.
- Prompt helpers (`debateOpenPrompt`, `debateReplyPrompt`, `debateSynthesisPrompt`) live next to `synthesizePrompt` as module-level functions.

### UI

- **`src/components/Chat/Message.tsx`:**
  - Third action-row icon button, `Swords` (lucide), tooltip "Debate: N rounds + synthesis". Rendered under the same conditions as Relay/Synthesize. Disabled while `isStreaming || isDebating` or when either API key is missing (tooltip explains which). Relay and Synthesize buttons likewise add `isDebating` to their disabled condition.
  - Origin captions for synthetic user bubbles: `⚔ debating Claude` / `⚔ debating Grok` for `kind: 'debate'`, `✦ debate conclusion` for `kind: 'debate-synthesis'`. Same caption slot as relay/synthesize; renders in snapshots viewer automatically via the `readOnly` path.
- **`src/components/Chat/PromptBar.tsx`:** every place that keys off `isStreaming` for input gating (Send↔Stop swap, textarea/attach/globe disabling, model-toggle disabling) keys off `isStreaming || isDebating` instead, so Stop stays available in the gaps between debate turns.
- **`src/components/Settings/SettingsDialog.tsx`:** Behavior section gains "Debate rounds" numeric input (min 1, max 10), wired like the other settings (local form state, committed on Save).
- **`src/lib/threadMarkdown.ts`:** origin lines for the new kinds: `_⚔ debating Claude_` and `_✦ debate conclusion_`.

## Work item 2 — Claude API modernization

### `src/lib/storage/db.ts`

- `SETTINGS_DEFAULTS.claudeModel: 'claude-opus-4-7'` → `'claude-opus-5'`.
- `loadSettings()`: after merging, map the stale old default forward: if the merged `claudeModel === 'claude-opus-4-7'`, replace with `'claude-opus-5'`. Read-time mapping, idempotent, custom model strings untouched. (Next Save persists the new value.)
- `SettingsRow.thinkingBudget` and `SETTINGS_DEFAULTS.thinkingBudget` removed. A leftover `thinkingBudget` key in the stored Dexie row is harmless.

### `src/lib/providers/types.ts`

- `StreamRequest.thinkingBudget` removed.
- `ANTHROPIC_MAX_TOKENS` 8192 → 64000. (We always stream; on current models `max_tokens` caps thinking + response together, so 8192 risks truncation.)

### `src/lib/providers/anthropic.ts`

- Request body type: `thinking?: { type: 'adaptive'; display: 'summarized' } | { type: 'disabled' }`.
- `buildAnthropicRequest`:
  - `max_tokens: ANTHROPIC_MAX_TOKENS` unconditionally (no more budget arithmetic).
  - `thinkingEnabled` → `thinking: { type: 'adaptive', display: 'summarized' }`; otherwise `thinking: { type: 'disabled' }`. `display: 'summarized'` is required for the ▸ Thinking expander to receive text — the API default omits thinking content.
  - Web search tool type `web_search_20250305` → `web_search_20260209`.
- Known edge (accepted): `{ type: 'disabled' }` is rejected by `claude-fable-5` if the user manually sets that model with thinking off; the error toast surfaces the API message. Not worth special-casing in a personal app.

### Ripples

- `src/state/thread.ts`: stop passing `thinkingBudget` to `streamProvider`.
- `src/state/settings.ts`: drop `thinkingBudget` from store state/actions.
- `src/components/Settings/SettingsDialog.tsx`: remove the thinking-budget input; keep the thinking toggle.
- `scripts/providers-smoke.ts`: remove `thinkingBudget: 4096` from the anthropic fixture (tests mock `fetch` and assert emitted events, so nothing else changes).

## Error handling

- Mid-debate stream failure: `runStream` already trims the empty placeholder and sets `errorMessage`; the debate loop sees `errorMessage` and stops. The user sees the existing error toast; completed turns persist.
- Stop mid-turn: abort propagates through `runStream`'s existing AbortError path; partial text persists (existing behavior); loop exits via the `isDebating` check.
- Missing key / empty source: early return with `errorMessage` (missing key) or silent no-op (empty source), matching relay.

## Testing / verification

- `npm run build` (TS strict) and `npm run smoke` must pass.
- Manual (needs real keys): start a debate from a Claude answer → Grok critiques, alternation runs `debateRounds` exchanges, Claude synthesizes; Stop mid-debate halts and keeps completed turns; captions render; snapshot of a debated thread shows captions; copy-thread markdown includes origin lines; Claude message with thinking on streams and renders thinking (proves the API fix).

## Out of scope (explicit)

- Auto-relay modes beyond this (always-on debate, prompt-bar trigger).
- Convergence detection / early stopping on agreement.
- Carrying images through debate turns (`textOf` is text-only — same as relay today).
- Grok-side model/param changes (`grok-4-latest` floats by design).
- Per-debate round-count picker (use Settings).
