# Debate Mode + Claude API Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in per-message "debate" action that auto-relays adversarial critiques between Claude and Grok for N rounds plus a closing synthesis, and repair the Claude request shape for current Anthropic models (adaptive thinking, current web-search tool, `claude-opus-5` default).

**Architecture:** The debate loop is a new `debateMessage` action in the existing Zustand thread store, following the relay/synthesize pattern exactly: synthetic user message + assistant placeholder + the existing private `runStream` helper, looped with alternating providers and an `isDebating` flag that keeps Stop live between turns. The API repair is confined to the provider layer (`anthropic.ts`, `types.ts`) plus settings plumbing.

**Tech Stack:** React 19 + Vite + TypeScript (strict), Zustand, Dexie, hand-rolled `fetch`+SSE providers (no vendor SDKs — intentional), shadcn/ui, lucide-react. Verification: `npm run build` (tsc strict + vite) and `npm run smoke` (Node scripts with mocked `fetch`).

**Spec:** `docs/superpowers/specs/2026-08-08-debate-mode-design.md` (approved). Decisions there are settled — do not relitigate.

## Global Constraints

- No vendor SDKs (`@anthropic-ai/sdk`, `openai`) — hand-rolled `fetch` is intentional for browser + Capacitor portability.
- No backend, no key proxy. Pure client-side, BYO keys.
- Do not add `baseUrl` to any tsconfig (`paths` works alone; TS 7 deprecates `baseUrl`).
- Tailwind v4 syntax only (CSS variables / `@theme inline`), never a v3 `tailwind.config.js`.
- Every task must end with `npm run build` AND `npm run smoke` passing.
- Grok/xAI side (`xai.ts`, `grok-4-latest`) is untouched by this plan.
- Commit messages end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Claude request modernization (provider layer)

The app currently sends `thinking: { type: 'enabled', budget_tokens }`, which the Anthropic API rejects with a 400 on `claude-opus-4-7` and newer. Replace with adaptive thinking, bump the web-search tool variant and `max_tokens`.

**Files:**
- Modify: `scripts/providers-smoke.ts`
- Modify: `src/lib/providers/types.ts`
- Modify: `src/lib/providers/anthropic.ts`
- Modify: `src/state/thread.ts` (one-line ripple: stop passing `thinkingBudget`)

**Interfaces:**
- Consumes: existing `buildAnthropicRequest(req: StreamRequest)` export in `anthropic.ts`; existing `eq(label, got, want)` helper in `providers-smoke.ts`.
- Produces: `StreamRequest` WITHOUT `thinkingBudget` (field deleted); `ANTHROPIC_MAX_TOKENS = 64000`; request body `thinking` is `{ type: 'adaptive', display: 'summarized' } | { type: 'disabled' }`; web-search tool type `web_search_20260209`. Later tasks rely on `StreamRequest` having no `thinkingBudget`.

- [ ] **Step 1: Add failing request-shape smoke cases**

In `scripts/providers-smoke.ts`, add `buildAnthropicRequest` to the imports at the top:

```typescript
import { buildAnthropicRequest, streamAnthropic } from '../src/lib/providers/anthropic.ts'
```

Then insert this block inside `run()`, immediately before the line `// Anthropic: error response`:

```typescript
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
  }
```

Also delete the line `        thinkingBudget: 4096,` from the existing `anthropic events` fixture (the field is about to disappear from `StreamRequest`).

- [ ] **Step 2: Run smoke to verify the new cases fail**

Run: `npm run smoke`
Expected: `FAIL anthropic request: adaptive thinking` (got `{"type":"enabled","budget_tokens":...}` or `undefined`), `FAIL anthropic request: max_tokens` (got 8192), `FAIL anthropic request: thinking disabled` (got undefined), `FAIL anthropic request: web search tool` (got `web_search_20250305`), exit code 1. The pre-existing `anthropic events` / `xai events` cases must still say `ok`.

- [ ] **Step 3: Update `types.ts`**

In `src/lib/providers/types.ts`:

Remove the line `  thinkingBudget?: number` from `StreamRequest`.

Change the last line from:

```typescript
export const ANTHROPIC_MAX_TOKENS = 8192
```

to:

```typescript
// Caps thinking + response together on current models; we always stream, so no timeout risk.
export const ANTHROPIC_MAX_TOKENS = 64000
```

- [ ] **Step 4: Update `anthropic.ts`**

In `src/lib/providers/anthropic.ts`, change the `thinking` field of `AnthropicRequestBody` from:

```typescript
  thinking?: { type: 'enabled'; budget_tokens: number }
```

to:

```typescript
  thinking?: { type: 'adaptive'; display: 'summarized' } | { type: 'disabled' }
```

Replace the whole `buildAnthropicRequest` function with:

```typescript
export function buildAnthropicRequest(req: StreamRequest): AnthropicRequestBody {
  const body: AnthropicRequestBody = {
    model: req.model,
    max_tokens: ANTHROPIC_MAX_TOKENS,
    stream: true,
    messages: req.messages.map(toAnthropicMessage),
  }
  if (req.systemPrompt && req.systemPrompt.trim()) {
    body.system = req.systemPrompt
  }
  // display: 'summarized' is required — the API default omits thinking text,
  // which would leave the ▸ Thinking expander permanently empty.
  body.thinking = req.thinkingEnabled
    ? { type: 'adaptive', display: 'summarized' }
    : { type: 'disabled' }
  if (req.webSearchEnabled) {
    body.tools = [{ type: 'web_search_20260209', name: 'web_search' }]
  }
  return body
}
```

- [ ] **Step 5: Remove the `thinkingBudget` call-site in `thread.ts`**

In `src/state/thread.ts`, inside `runStream`, the `streamProvider` call currently reads:

```typescript
        thinkingEnabled: settings.thinkingOn,
        thinkingBudget: settings.thinkingBudget,
```

Delete the `thinkingBudget: settings.thinkingBudget,` line only.

- [ ] **Step 6: Run smoke and build to verify everything passes**

Run: `npm run smoke && npm run build`
Expected: all smoke cases `ok` (including the four new ones and the pre-existing event-mapping cases), build exits 0.

- [ ] **Step 7: Commit**

```bash
git add scripts/providers-smoke.ts src/lib/providers/types.ts src/lib/providers/anthropic.ts src/state/thread.ts
git commit -m "fix: modernize Claude request shape (adaptive thinking, web_search_20260209, 64k max_tokens)

budget_tokens was removed by the Anthropic API in the claude-opus-4-7
generation — requests with thinking on have been returning 400.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Settings modernization + debateRounds setting

New default Claude model with a read-time migration for the stale stored default, `thinkingBudget` removed everywhere, new `debateRounds` setting with its UI.

**Files:**
- Modify: `src/lib/storage/db.ts`
- Modify: `src/state/settings.ts`
- Modify: `src/components/Settings/SettingsDialog.tsx`

**Interfaces:**
- Consumes: `StreamRequest` without `thinkingBudget` (Task 1).
- Produces: `SettingsRow` = `{ id: 1; claudeModel; grokModel; systemPrompt; thinkingOn: boolean; debateRounds: number; theme; lastUsedModel }` (NO `thinkingBudget`); `SETTINGS_DEFAULTS.claudeModel === 'claude-opus-5'`, `SETTINGS_DEFAULTS.debateRounds === 3`; `useSettings` store exposes `debateRounds: number` (Tasks 3 and 4 read `useSettings.getState().debateRounds` / `useSettings((s) => s.debateRounds)`).

- [ ] **Step 1: Update `db.ts`**

In `src/lib/storage/db.ts`:

In `SettingsRow`, replace `  thinkingBudget: number` with `  debateRounds: number`.

Replace `SETTINGS_DEFAULTS` with:

```typescript
export const SETTINGS_DEFAULTS: SettingsRow = {
  id: 1,
  claudeModel: 'claude-opus-5',
  grokModel: 'grok-4-latest',
  systemPrompt: '',
  thinkingOn: true,
  debateRounds: 3,
  theme: 'system',
  lastUsedModel: 'claude',
}
```

Replace `loadSettings` with:

```typescript
export async function loadSettings(): Promise<SettingsRow> {
  const row = await db.settings.get(1)
  if (!row) return SETTINGS_DEFAULTS
  const merged = { ...SETTINGS_DEFAULTS, ...row, id: 1 as const }
  // Stored copy of the old shipped default — map forward so existing installs
  // stop targeting a model whose request shape we no longer send. Custom
  // model strings are untouched. Read-time only; next Save persists it.
  if (merged.claudeModel === 'claude-opus-4-7') {
    merged.claudeModel = 'claude-opus-5'
  }
  return merged
}
```

Note: a leftover `thinkingBudget` key inside the stored Dexie row is harmless — it rides along in the spread and TypeScript ignores it.

- [ ] **Step 2: Update `settings.ts`**

In `src/state/settings.ts`, three mechanical swaps:

In `SettingsState`, replace `  thinkingBudget: number` with `  debateRounds: number`.

In the store initializer, replace `  thinkingBudget: SETTINGS_DEFAULTS.thinkingBudget,` with `  debateRounds: SETTINGS_DEFAULTS.debateRounds,`.

In `hydrate()`'s `set({...})`, replace `      thinkingBudget: row.thinkingBudget,` with `      debateRounds: row.debateRounds,`.

- [ ] **Step 3: Update `SettingsDialog.tsx`**

In `src/components/Settings/SettingsDialog.tsx`:

Replace the local-state line

```typescript
  const [thinkingBudget, setThinkingBudget] = useState(settings.thinkingBudget)
```

with

```typescript
  const [debateRounds, setDebateRounds] = useState(settings.debateRounds)
```

In the `useEffect` hydration block, replace `    setThinkingBudget(settings.thinkingBudget)` with `    setDebateRounds(settings.debateRounds)`.

In `handleSave`, replace the `updateSettings` payload with:

```typescript
        settings.updateSettings({
          claudeModel: claudeModel.trim() || 'claude-opus-5',
          grokModel: grokModel.trim() || 'grok-4-latest',
          systemPrompt,
          thinkingOn,
          debateRounds:
            Number.isFinite(debateRounds) && debateRounds >= 1
              ? Math.min(Math.floor(debateRounds), 10)
              : 3,
          theme,
        }),
```

Update the Claude model input placeholder from `placeholder="claude-opus-4-7"` to `placeholder="claude-opus-5"`.

Update the thinking toggle description from `Sends a thinking budget on Claude requests.` to `Claude thinks adaptively before answering.`

Replace the entire thinking-budget input block

```tsx
            <div className="grid gap-2">
              <Label htmlFor="thinking-budget">Thinking budget (tokens)</Label>
              <Input
                id="thinking-budget"
                type="number"
                min={1024}
                step={1024}
                disabled={!thinkingOn}
                value={thinkingBudget}
                onChange={(e) => setThinkingBudget(Number(e.target.value))}
              />
            </div>
```

with

```tsx
            <div className="grid gap-2">
              <Label htmlFor="debate-rounds">Debate rounds</Label>
              <Input
                id="debate-rounds"
                type="number"
                min={1}
                max={10}
                step={1}
                value={debateRounds}
                onChange={(e) => setDebateRounds(Number(e.target.value))}
              />
              <span className="text-xs text-muted-foreground">
                Exchanges per debate before the closing synthesis.
              </span>
            </div>
```

- [ ] **Step 4: Run build and smoke**

Run: `npm run build && npm run smoke`
Expected: both exit 0. If build errors mention `thinkingBudget`, a reference was missed — grep: `grep -rn thinkingBudget src/ scripts/` must return nothing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/db.ts src/state/settings.ts src/components/Settings/SettingsDialog.tsx
git commit -m "feat: claude-opus-5 default (with stored-default migration), debateRounds setting, drop thinkingBudget

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Debate orchestration (thread store)

The debate loop: alternating adversarial exchanges + closing synthesis, cancellable throughout.

**Files:**
- Modify: `src/lib/storage/db.ts` (origin kind union — one line)
- Modify: `src/state/thread.ts`

**Interfaces:**
- Consumes: `useSettings.getState().debateRounds` (Task 2); existing private `runStream({ provider, apiKey, model, assistantMsgId })`, `getKeyAndModel(provider)`, `newId()`, `providerLabel(p)`, `textOf(message)`, `persistThread(messages)`.
- Produces: `ThreadMessage['origin']['kind']` union includes `'debate' | 'debate-synthesis'`; `useThread` store exposes `isDebating: boolean` and `debateMessage: (id: string) => Promise<void>` (Task 4 reads both).

- [ ] **Step 1: Extend the origin union in `db.ts`**

In `src/lib/storage/db.ts`, change the `ThreadMessage.origin` line from:

```typescript
  origin?: { kind: 'relay' | 'synthesize'; from: ProviderId }
```

to:

```typescript
  origin?: { kind: 'relay' | 'synthesize' | 'debate' | 'debate-synthesis'; from: ProviderId }
```

(Additive optional field — no `db.version()` bump, same precedent as relay/synthesize in Phase 5.)

- [ ] **Step 2: Add state, interface, and prompt helpers in `thread.ts`**

In `src/state/thread.ts`:

In the `ThreadState` interface, after `  isStreaming: boolean`, add:

```typescript
  isDebating: boolean
```

and after the `synthesizeMessage` line, add:

```typescript
  debateMessage: (id: string) => Promise<void>
```

After the module-level `synthesizePrompt` function, add:

```typescript
function debateOpenPrompt(from: ProviderId, body: string): string {
  return `Here is what ${providerLabel(from)} said. Challenge it: find weaknesses, correct errors, and add what's missing. Be substantive, not polite.\n\n${body}`
}

function debateReplyPrompt(from: ProviderId): string {
  return `Respond to ${providerLabel(from)}'s critique above: defend what holds up, concede what doesn't, and improve the answer.`
}

function debateSynthesisPrompt(): string {
  return 'The debate is over. Write your final, best answer to the original question, incorporating the valid points raised on both sides.'
}
```

In the store's returned object, after `  isStreaming: false,` add:

```typescript
  isDebating: false,
```

- [ ] **Step 3: Extend the guards and lifecycle actions**

Still in `src/state/thread.ts` — between debate turns `isStreaming` is briefly false, so every entry point must also check `isDebating`:

In `sendMessage`, change `      if (get().isStreaming) return` to `      if (get().isStreaming || get().isDebating) return`.

In `relayMessage`, change `      if (get().isStreaming) return` to `      if (get().isStreaming || get().isDebating) return`.

In `synthesizeMessage`, change `      if (get().isStreaming) return` to `      if (get().isStreaming || get().isDebating) return`.

Replace `cancel()` with (clearing the flag BEFORE aborting, so the loop cannot start another turn):

```typescript
    cancel() {
      set({ isDebating: false })
      abortController?.abort()
    },
```

In `clear()`, add `        isDebating: false,` to the `set({...})` object (after `isStreaming: false,`).

In `loadFromSnapshot()`, add `        isDebating: false,` to the `set({...})` object (after `isStreaming: false,`).

- [ ] **Step 4: Add the `debateMessage` action**

In `src/state/thread.ts`, after the `synthesizeMessage` action, add:

```typescript
    async debateMessage(id) {
      if (get().isStreaming || get().isDebating) return
      const source = get().messages.find((m) => m.id === id)
      if (!source || source.role !== 'assistant' || !source.provider) return
      const body = textOf(source)
      if (!body) return

      const settings = useSettings.getState()
      if (!settings.anthropicKey || !settings.xaiKey) {
        const missing = !settings.anthropicKey ? 'Anthropic' : 'xAI'
        set({
          errorMessage: `Debate needs both API keys — add the ${missing} key in Settings.`,
        })
        return
      }

      const rounds = Math.max(1, settings.debateRounds)
      const sourceProvider = source.provider
      const otherProvider: ProviderId = sourceProvider === 'claude' ? 'grok' : 'claude'

      set({ isDebating: true, errorMessage: null })
      try {
        // Turns 0..rounds-1 are exchanges (alternating, starting with the other
        // model); turn === rounds is the closing synthesis by the original model.
        for (let turn = 0; turn <= rounds; turn++) {
          const isSynthesis = turn === rounds
          const target: ProviderId = isSynthesis
            ? sourceProvider
            : turn % 2 === 0
              ? otherProvider
              : sourceProvider
          const respondingTo: ProviderId = target === 'claude' ? 'grok' : 'claude'
          const { apiKey, model } = getKeyAndModel(target)

          const promptText = isSynthesis
            ? debateSynthesisPrompt()
            : turn === 0
              ? debateOpenPrompt(sourceProvider, body)
              : debateReplyPrompt(respondingTo)

          const now = Date.now()
          const userMsg: ThreadMessage = {
            id: newId(),
            role: 'user',
            content: [{ type: 'text', text: promptText }],
            origin: {
              kind: isSynthesis ? 'debate-synthesis' : 'debate',
              from: respondingTo,
            },
            createdAt: now,
          }
          const assistantMsg: ThreadMessage = {
            id: newId(),
            role: 'assistant',
            provider: target,
            content: [],
            createdAt: now + 1,
          }
          const messages = [...get().messages, userMsg, assistantMsg]
          set({ messages, isStreaming: true, streamingMessageId: assistantMsg.id })
          await persistThread(messages)

          await runStream({
            provider: target,
            apiKey,
            model,
            assistantMsgId: assistantMsg.id,
          })

          // Cancelled (Stop/clear/snapshot-load) or the turn errored — keep
          // completed turns, skip the rest including the synthesis.
          if (!get().isDebating || get().errorMessage) break
        }
      } finally {
        set({ isDebating: false })
      }
    },
```

- [ ] **Step 5: Run build and smoke**

Run: `npm run build && npm run smoke`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage/db.ts src/state/thread.ts
git commit -m "feat: debate orchestration — alternating adversarial exchanges + synthesis in thread store

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Debate UI (button, captions, prompt-bar gating, markdown export)

**Files:**
- Modify: `src/components/Chat/Message.tsx`
- Modify: `src/components/Chat/PromptBar.tsx`
- Modify: `src/lib/threadMarkdown.ts`

**Interfaces:**
- Consumes: `useThread((s) => s.isDebating)`, `useThread((s) => s.debateMessage)` (Task 3); `useSettings((s) => s.debateRounds)` (Task 2); origin kinds `'debate' | 'debate-synthesis'` (Task 3).
- Produces: user-visible debate affordances. Nothing downstream consumes new exports.

- [ ] **Step 1: Update `Message.tsx`**

In `src/components/Chat/Message.tsx`:

Change the lucide import line to:

```typescript
import { ArrowRightLeft, Check, Copy, Sparkles, Swords } from 'lucide-react'
```

Replace `originCaption` with:

```typescript
function originCaption(origin: NonNullable<ThreadMessage['origin']>): string {
  const fromLabel = providerLabel(origin.from)
  if (origin.kind === 'relay') return `↻ relayed from ${fromLabel}`
  if (origin.kind === 'debate') return `⚔ debating ${fromLabel}`
  if (origin.kind === 'debate-synthesis') return '✦ debate conclusion'
  return `✦ synthesizing ${fromLabel}`
}
```

After the `const synthesizeMessage = useThread(...)` line, add:

```typescript
  const isDebating = useThread((s) => s.isDebating)
  const debateMessage = useThread((s) => s.debateMessage)
  const debateRounds = useSettings((s) => s.debateRounds)
```

Replace the `relaySynthDisabled` / `disabledReason` block with:

```typescript
  const busy = isStreaming || isDebating
  const relaySynthDisabled = busy || !otherKey
  const disabledReason = busy
    ? 'Wait for the current response to finish'
    : !otherKey
      ? `Add a ${otherLabel} API key in Settings`
      : ''

  const debateDisabled = busy || !anthropicKey || !xaiKey
  const debateDisabledReason = busy
    ? 'Wait for the current response to finish'
    : !anthropicKey || !xaiKey
      ? `Debate needs both API keys — add the ${!anthropicKey ? 'Anthropic' : 'xAI'} key in Settings`
      : ''
```

Inside the `{showRelaySynthesize && otherProvider && (<>...</>)}` fragment, after the Synthesize `</Tooltip>` closing tag, add a third button:

```tsx
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Start debate"
                      disabled={debateDisabled}
                      onClick={() => void debateMessage(message.id)}
                    >
                      <Swords className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {debateDisabled
                      ? debateDisabledReason
                      : `Debate: ${debateRounds} exchange${debateRounds === 1 ? '' : 's'} + synthesis`}
                  </TooltipContent>
                </Tooltip>
```

- [ ] **Step 2: Update `PromptBar.tsx`**

In `src/components/Chat/PromptBar.tsx`:

After the `const isStreaming = useThread((s) => s.isStreaming)` line, add:

```typescript
  const isDebating = useThread((s) => s.isDebating)
```

After the `const hasKey = ...` line, add:

```typescript
  const busy = isStreaming || isDebating
```

Then swap the gating (five spots):

- `const canSend = !isStreaming && hasKey && hasContent` → `const canSend = !busy && hasKey && hasContent`
- Attach button: `disabled={isStreaming}` → `disabled={busy}`
- Web-search button: `disabled={isStreaming}` → `disabled={busy}`
- `<ModelToggle ... disabled={isStreaming} />` → `disabled={busy}`
- Send/Stop swap: `{isStreaming ? (` → `{busy ? (`

(The Stop button's existing `cancel` handler already ends the debate — Task 3 made `cancel()` clear `isDebating`.)

- [ ] **Step 3: Update `threadMarkdown.ts`**

In `src/lib/threadMarkdown.ts`, replace `originLine` with:

```typescript
function originLine(origin: NonNullable<ThreadMessage['origin']>): string {
  const fromLabel = providerLabel(origin.from)
  if (origin.kind === 'relay') return `_↻ relayed from ${fromLabel}_`
  if (origin.kind === 'debate') return `_⚔ debating ${fromLabel}_`
  if (origin.kind === 'debate-synthesis') return '_✦ debate conclusion_'
  return `_✦ synthesizing ${fromLabel}_`
}
```

- [ ] **Step 4: Run build and smoke**

Run: `npm run build && npm run smoke`
Expected: both exit 0.

- [ ] **Step 5: Boot the dev server and check for console errors**

Run the dev server (background): `npm run dev`
Open `http://localhost:5173` in a browser. Expected: app renders (header + prompt bar), zero console errors. The debate button itself only renders on completed assistant messages, which need real API keys — full manual verification is the user's step, listed in Task 5.

Stop the dev server afterwards.

- [ ] **Step 6: Commit**

```bash
git add src/components/Chat/Message.tsx src/components/Chat/PromptBar.tsx src/lib/threadMarkdown.ts
git commit -m "feat: debate UI — Swords action button, origin captions, busy-state gating, markdown export

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Docs, iOS sync, final verification

**Files:**
- Modify: `HANDOFF.md`
- (Generated) `ios/App/App/public` via `npx cap sync ios`

**Interfaces:**
- Consumes: everything above.
- Produces: updated handoff doc; iOS project carrying the new web build.

- [ ] **Step 1: Append a Phase 10 section to `HANDOFF.md`**

In `HANDOFF.md`, find the line `## Phase 9 — remaining manual steps (Ilias, at your Mac)` and insert this section immediately BEFORE it (verify every path/claim below still matches the code as implemented — if a detail drifted during implementation, write what the code actually does):

```markdown
### Phase 10 (debate mode + Claude API modernization) — 2026-08-08

Spec: `docs/superpowers/specs/2026-08-08-debate-mode-design.md`. Highlights:

- **Debate mode** — `Swords` button on completed assistant bubbles runs `debateRounds`
  (Settings → Behavior, default 3) adversarial exchanges alternating between the models,
  then a closing synthesis by the original answerer. Orchestrated by `debateMessage(id)`
  in `src/state/thread.ts` (loop over the existing `runStream`); `isDebating` keeps
  Stop/input gating live between turns; Stop/clear/snapshot-load all end the debate and
  keep completed turns. Origin kinds `debate` / `debate-synthesis` render captions
  (`⚔ debating Claude`, `✦ debate conclusion`) in chat, snapshots, and copied markdown.
- **Claude API repair** — `thinking: { type: 'enabled', budget_tokens }` was removed by
  the Anthropic API in the claude-opus-4-7 generation (400s). Requests now send
  `thinking: { type: 'adaptive', display: 'summarized' }` (or `{ type: 'disabled' }`),
  `max_tokens: 64000`, and `web_search_20260209`. Default model is `claude-opus-5`;
  `loadSettings()` maps a stored `claude-opus-4-7` (the old default) forward at read
  time. The `thinkingBudget` setting is gone.

**Verified:** `npm run build` + `npm run smoke` (SSE parsing, provider event mapping,
Anthropic request-shape assertions). Real-key verification (below) is manual.

**Manual verification (Ilias, with real keys):** send a Claude message with thinking on —
text + thinking stream (proves the API fix); start a debate from a Claude answer — Grok
critiques, alternation runs, Claude synthesizes; Stop mid-debate keeps completed turns;
snapshot + copy-thread show the new captions.
```

Before committing, verify the claims: `grep -n debateMessage src/state/thread.ts`, `grep -n "web_search_20260209" src/lib/providers/anthropic.ts`, and count the smoke `ok` lines from the Task 4 run — adjust the section text if reality differs.

- [ ] **Step 2: Full verification run**

Run: `npm run build && npm run smoke`
Expected: both exit 0.

- [ ] **Step 3: Sync the iOS project**

Run: `npx cap sync ios`
Expected: copies `dist/` into the iOS project and updates plugins; exits 0. If it fails on a native tooling issue (CocoaPods/SPM resolution), report the error and continue — the web build is unaffected and the user can sync from Xcode later.

- [ ] **Step 4: Commit**

```bash
git add HANDOFF.md ios
git commit -m "docs: record phase 10 (debate mode + Claude API modernization); sync iOS web assets

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Post-plan manual verification (user, with real API keys)

1. Settings shows `claude-opus-5` as the Claude model (migration worked) and "Debate rounds" instead of the budget field.
2. Claude message with thinking ON streams text and shows the ▸ Thinking expander with content.
3. Debate from a Claude answer: Grok opens with a critique (caption `⚔ debating Claude`), alternation runs the configured exchanges, Claude closes (caption `✦ debate conclusion`). Stop mid-debate halts cleanly and keeps completed turns.
4. Copy thread → markdown includes `_⚔ debating …_` / `_✦ debate conclusion_` lines. Snapshot viewer shows the captions.
5. On iPhone after `npx cap open ios` + run: same behaviors.
