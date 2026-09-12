# ai4me — session handoff

A personal Claude + Grok web client, later to be wrapped with Capacitor for iPhone. Phases 1–8 are complete and verified. **Phase 9 (Capacitor wrap) is partially complete** — all the code is in place; the remaining work is `npx cap add ios` and Xcode signing, which Ilias must do at his Mac/iPhone. **Phase 10 (debate mode + Claude API modernization) is complete and verified at build + smoke.** **Phase 11 (three-way model picker: Fable / Opus / Grok 4.6) is complete and verified at build + smoke.** **Phase 12 (short cross-model turns + collapsed debate + live debate tracker) is complete and verified at build + smoke + seeded-thread browser check.** **Phase 13 (Synthesize merges both views when both models have spoken) is complete and verified at build + smoke.** **Phase 14 (cover-aligned restyle: black, heavy wordmark, tracked caps, hairlines) is complete and verified at build + smoke + seeded-thread browser check.** **Phase 15 (API key fields: masked chip + live validity check) is complete and verified at build + smoke + browser.**

## How to resume

1. Read `/Users/iliasrafailidis/.claude/plans/in-this-folder-i-jaunty-charm.md` — the approved plan, full design and rationale.
2. Read this file for context on what's already done and what's next.
3. Phase 9 has remaining manual steps — see "Phase 9 — remaining manual steps" below.

User is Ilias (`iamilias@gmail.com`). This is a personal app primarily for his daily use.

## Approved decisions (do not relitigate)

These were settled by interview in the prior session. Don't re-ask.

### Architecture
- **Pure client-side, no backend.** API keys stored on-device (localStorage on web; Capacitor Preferences on iOS). Keys never leave the device. Per-device key entry, no cross-device sync — accepted.

### Stack
- React 19 + Vite 8 + TypeScript + Tailwind v4 + shadcn/ui (Radix, Geist font). Since Phase 14 the theme is the site cover's: pure black / near-white, grey tracked-caps micro-labels, 1px hairlines, 2px radius; light is the exact inversion.
- Zustand for global state. Dexie for IndexedDB.
- Hand-rolled `fetch` + SSE parsing for both providers — no vendor SDKs.
- Capacitor wrap is phase 9 (iOS later). Web app must be fully usable standalone first.

### Conversation model — THE differentiator
- **Single rolling thread**, per-message model picker (Claude vs Grok).
- The other model sees prior turns as context.
- **Manual relay** button on each assistant message: send this message to the other model as the next user turn.
- **Synthesize** action on each assistant message: ask the other model to critique/synthesize that answer (three-turn pattern, no loop risk).
- Auto-relay / debate mode is explicitly v2.

### History
- One rolling thread + manual snapshots.
- "Clear" starts fresh. "Save snapshot" archives current state with a user-typed name. Snapshots are browsable, read-only, and can be loaded as the seed for a new thread. Stored in IndexedDB.

### Models
- **Best only**, one per provider. Latest Claude flagship (Opus tier) + latest Grok flagship.
- No model menu beyond "Claude vs Grok." *(Superseded in Phase 11: the composer offers Fable / Opus / Grok 4.6 — two Claude tiers, one Grok.)*
- Exact model IDs are editable strings in Settings (so versions can be bumped without a rebuild). *(Phase 11 turned these into Selects over the curated list in `src/lib/models.ts`; an unknown stored ID still appears as an extra option, so nothing is lost on upgrade.)*
- Default on a fresh thread: last-used model preselected.

### Features (v1)
- **System prompt:** single global default, editable in Settings, **ships empty**. Sent as the `system` field on both providers. Empty = no system prompt sent (no vendor fallback exists at the API layer).
- **Vision (v1):** image attach button on the prompt bar. Web: file picker. iOS: camera + photo library via Capacitor. Encoded as base64 / data URI for both providers.
- **Web search (v1):** per-message toggle. When on, Claude requests include the `web_search` tool; Grok requests enable Live Search. Off by default.
- **Extended thinking (Claude, v1):** Settings toggle (default on); when on, Opus requests use adaptive thinking (`{ type: 'adaptive', display: 'summarized' }`); thinking blocks render as a collapsed `▸ Thinking` expander. Fable always thinks — the toggle does not apply to it (Phase 11).

### Polish defaults
- Streaming for both providers (SSE).
- Markdown rendering with code-block syntax highlighting (`react-markdown` + `shiki`).
- Copy-as-markdown per message; "copy whole thread" in menu.
- Theme: light / dark / system, persisted.
- Voice input: rely on iOS keyboard dictation. No custom voice.

## Current state — Phases 1–8 complete; Phase 9 partially complete (code in place, native bringup pending); Phases 10–15 complete

### Phase 1 (scaffold) — verified
- `npm run build` passes
- Path alias `@/*` → `src/*` in `tsconfig.app.json`, `tsconfig.json`, `vite.config.ts`
- Tailwind v4 via `@tailwindcss/vite` plugin and `@import "tailwindcss";` in `src/index.css`
- shadcn `components.json` + nova preset CSS variables in `src/index.css`
- shadcn primitives in `src/components/ui/`: `button, dialog, dropdown-menu, scroll-area, switch, textarea, tooltip, input, label, select, separator`
- Runtime deps: `zustand, dexie, react-markdown, remark-gfm, shiki, lucide-react, @fontsource-variable/geist`

### Phase 2 (settings) — verified end-to-end in browser
- `src/lib/storage/db.ts` — Dexie schema (`settings`, `thread`, `snapshots`), `SETTINGS_DEFAULTS`, `loadSettings()`, `saveSettings()`. Tables for `thread` and `snapshots` defined now so phases 4 and 6 don't need a migration.
- `src/lib/storage/keys.ts` — `KeyStore` interface (`get`/`set`/`delete`), localStorage-backed impl, prefix `ai4me:secret:`. Constants `KEY_ANTHROPIC`, `KEY_XAI`. **Swap point for phase 9** — replace the singleton with a Capacitor Preferences impl, no callsite changes needed.
- `src/state/settings.ts` — Zustand store (`useSettings`). Holds all settings + `hydrated` flag. Actions: `hydrate()`, `setApiKey()`, `updateSettings()`, `setLastUsedModel()`. Keys persist via `keys.ts`; everything else via Dexie.
- `src/lib/theme.ts` — `applyTheme(theme)` toggles `.dark` on `<html>`, resolves `system` via `matchMedia('(prefers-color-scheme: dark)')`. `watchSystemTheme()` returns a cleanup fn for the OS-level listener.
- `src/components/Settings/SettingsDialog.tsx` — Sectioned dialog (API keys / Models / Behavior / Appearance). Form-state-local with hydration on open; commits via store actions on Save.
- `src/App.tsx` — Header with gear button → opens dialog. Hydrates store on mount. Watches system theme changes for `theme === 'system'`.

**Defaults shipped (editable in UI):**
- `claudeModel: 'claude-opus-4-7'`
- `grokModel: 'grok-4-latest'` (now `grok-4.6`, see Phase 11)
- `thinkingOn: true`, `thinkingBudget: 8000`
- `systemPrompt: ''`, `theme: 'system'`, `lastUsedModel: 'claude'`

**Verified manually:** Set non-default values + Light theme + custom keys → reloaded → all restored. Keys present in `localStorage` under `ai4me:secret:*`. No console errors.

Notes:
- `tsconfig.app.json` and `tsconfig.json` use `paths` without `baseUrl` (TS 7 deprecates `baseUrl`). Don't re-add it.
- API keys are intentionally split out from Dexie via `keys.ts` so iOS can use a more secure backend in phase 9. All other settings are in Dexie.

### Phase 3 (provider modules) — verified via smoke tests
- `src/lib/sse.ts` — `parseSSEStream(stream)` async generator. Handles CRLF, comments, multi-line `data:`, multi-event chunks, partial chunks across reads.
- `src/lib/providers/types.ts` — `ProviderMessage` (role + `ContentBlock[]` + optional provider tag), `StreamEvent` (`text-delta | thinking-delta | tool-start | error | done`), `StreamRequest`, `ProviderError`, `ANTHROPIC_MAX_TOKENS = 8192`.
- `src/lib/providers/anthropic.ts` — `streamAnthropic(req)` against `https://api.anthropic.com/v1/messages` with `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`. Tracks block types by `index` so `text_delta` vs `thinking_delta` are routed correctly. Wires `thinking: { type: 'enabled', budget_tokens }` and `tools: [{ type: 'web_search_20250305', name: 'web_search' }]` from request flags.
- `src/lib/providers/xai.ts` — `streamXai(req)` against `https://api.x.ai/v1/chat/completions` (OpenAI-shape). Maps `delta.reasoning_content` → `thinking-delta`, `delta.content` → `text-delta`, finishes on `finish_reason` or `[DONE]`. Wires `search_parameters: { mode: 'on' }` for web search. Collapses text-only content to a `string` body; mixed text+image sends parts array.
- `src/lib/providers/index.ts` — `streamProvider(provider, req)` dispatcher + re-exports.

**Smoke tests:** `npm run smoke` runs `scripts/sse-smoke.ts` (8 cases) + `scripts/providers-smoke.ts` (3 cases — anthropic event mapping, xai event mapping, anthropic 401 → `ProviderError`). Uses `scripts/alias-loader.mjs` to resolve `@/` and extension-less relative imports under Node's `--experimental-strip-types`. Run before phase 4 work and any time you touch SSE or provider code.

**CORS deferred:** Browser calls aren't exercised end-to-end yet. If Anthropic or xAI block the dev origin in phase 4, add `server.proxy` to `vite.config.ts` as a dev-only workaround (Capacitor goes through native HTTP, so prod is unaffected).

### Phase 4 (chat UI + thread persistence) — verified end-to-end in browser
- `src/lib/storage/db.ts` — added `ContentBlock` type, updated `ThreadMessage` to `content: ContentBlock[]` with optional `thinking?: string`. Added `loadThread()` / `persistThread(messages)` helpers (transactional clear + bulkPut).
- `src/lib/providers/types.ts` — re-exports `ContentBlock` from db so providers + state share one source of truth.
- `src/state/thread.ts` — `useThread` store. Holds `messages`, `currentModel`, `isStreaming`, `streamingMessageId`, `errorMessage`. Actions: `hydrate`, `setCurrentModel` (also writes to settings.lastUsedModel), `sendMessage`, `cancel`, `clear`, `dismissError`. Streaming uses `streamProvider(currentModel, …)` and an in-module `AbortController`. Persistence: writes after the user message lands, and again in the `finally` block when the stream ends/aborts/errors. Empty assistant placeholders (no text + no thinking) are dropped on completion so failed turns don't leave ghost bubbles.
- `src/lib/markdown.tsx` — react-markdown + remark-gfm wrapper with utility-driven styling (no typography plugin). shiki integration deferred to phase 8.
- `src/components/Chat/Message.tsx` — role-aware bubble, "Claude"/"Grok" provider label above assistant bubbles, blinking cursor while streaming, plain text for user messages, markdown for assistant.
- `src/components/Chat/ThinkingBlock.tsx` — collapsed `▸ Thinking` / `▸ Thinking…` expander; phase 7 will only need to ensure thinking data flows in (it already does — Claude streams it).
- `src/components/Chat/MessageList.tsx` — flex-1 scroll container, sticky-to-bottom autoscroll that respects when the user scrolls up (>100px from bottom disables stick), inline destructive-styled error toast with dismiss action.
- `src/components/Chat/PromptBar.tsx` — Textarea + segmented Claude/Grok toggle (`role="radiogroup"`; replaced by a three-way Select in Phase 11), Send/Stop button. Cmd+Enter submits. Per-provider key check disables Send and adapts placeholder copy.
- `src/components/Chat/ChatView.tsx` — vertical layout wrapper.
- `src/App.tsx` — hydrates settings then thread (sequential — thread reads `lastUsedModel`). Shows trash icon in header only when thread has messages, with `confirm()` guard. Reuses theme application from phase 2.

**Verified manually in browser:**
- Real call to `https://api.anthropic.com/v1/messages` from `localhost:5173` succeeded at the network layer (returned 401 with auth-error body) — **CORS works without a dev proxy** when `anthropic-dangerous-direct-browser-access: true` is sent.
- Real call to `https://api.x.ai/v1/chat/completions` from `localhost:5173` succeeded at the network layer (returned 400 "Incorrect API key provided") — **xAI CORS also works without a proxy**.
- User message renders, empty assistant placeholder cleaned up on error, error toast shows the upstream JSON body with dismiss action, Send/Stop swap on streaming state, model toggle disabled while streaming, Cmd+Enter submits, reload preserves thread + selected model + cleared error.

**Real-streaming verification (text actually rendering token-by-token) was not run** because that needs the user's real API keys. The SSE parser + provider event mapping are covered by `npm run smoke` (8 + 3 cases). With CORS and error paths confirmed, the remaining streaming-text path is just "drain the generator and append" which is exercised in the smoke tests.

### Phase 5 (cross-model relay + synthesize) — verified at build + smoke; streaming awaiting user keys
- `src/lib/storage/db.ts` — added optional `origin?: { kind: 'relay' | 'synthesize'; from: ProviderId }` on `ThreadMessage`. No `db.version()` bump (additive optional field; Dexie store schema unchanged).
- `src/lib/messageText.ts` — new tiny module with shared `textOf(message)` helper (was duplicated inside `Message.tsx`).
- `src/state/thread.ts` — extracted private `runStream({ provider, apiKey, model, assistantMsgId })` from `sendMessage` (AbortController + `for await` loop + try/catch/finally with empty-message trim + persist). Added `relayMessage(id)` and `synthesizeMessage(id)` actions. Both find the source assistant message, validate `isStreaming` + the *other* provider's key, build a synthetic user msg + assistant placeholder for the other provider, persist, then call `runStream`. Relay sends the raw text body. Synthesize wraps with `synthesizePrompt(from, body)` (private helper) → `Here is what ${from} said. Critique and synthesize:\n\n${body}`. `lastUsedModel` is intentionally NOT touched by relay/synthesize — only the user's explicit picker change updates it.
- `src/components/Chat/Message.tsx` — Relay (`ArrowRightLeft`) and Synthesize (`Sparkles`) icon buttons render in a row beneath each completed assistant bubble. shadcn `Button` with `size="icon-sm"` + `variant="ghost"`. Disabled while streaming or when the target provider has no key; tooltip explains why. Synthetic user bubbles render a caption above the bubble — `↻ relayed from Claude` or `✦ synthesizing Grok` — read from `message.origin`. Local `textOf` replaced with the shared import.

**Verified:** `npm run build` passes (TS strict). `npm run smoke` still passes (8 SSE + 3 provider cases unchanged). Dev server boots and serves 200. Streaming verification across providers (relay Claude→Grok, synthesize Grok→Claude) needs the user's real API keys and was not run from this session.

**Notes for the next phase:**
- The action row in `Message.tsx` (the `flex items-center gap-1 px-1` div) is the natural home for the Phase 8 "copy as markdown" button — just append another icon button there.
- Image content blocks are skipped by `textOf` today, so relay/synthesize only carry text. Revisit when vision lands in Phase 7.

### Phase 6 (snapshots) — verified at build + smoke + browser empty-state
- `src/state/thread.ts` — added `loadFromSnapshot(messages)` action. Aborts any in-flight stream, deep-clones messages with fresh IDs (so editing the loaded thread doesn't mutate the snapshot record), replaces `messages`, persists. Used by the snapshots store.
- `src/state/snapshots.ts` — new Zustand store. Holds `snapshots: Snapshot[]` (most-recent-first) + `hydrated`. Actions: `hydrate()` (one-shot Dexie read), `save(name, messages)` (deep-clones messages, writes a new `Snapshot` row, prepends to local list, returns it; rejects empty name or empty messages by returning `null`), `load(id)` (calls `useThread.getState().loadFromSnapshot(snap.messages)`), `remove(id)` (Dexie delete + filter local).
- `src/components/Chat/Message.tsx` — added `readOnly?: boolean` prop. Gates the relay/synthesize action row off when set. Used by the snapshot viewer.
- `src/components/Snapshots/SaveSnapshotDialog.tsx` — small dialog. Auto-fills a default name like `Snapshot 2026-05-07 22:34`. Save is disabled when name is empty or thread is empty. Enter submits.
- `src/components/Snapshots/SnapshotsDialog.tsx` — combined list + viewer + load + delete in one dialog. Empty state when no snapshots. Each row: name, relative time, message count, inline "Load" + delete icon. Clicking the row body opens the viewer (which renders `Message` with `readOnly` and shows ✦/↻ origin captions on relayed/synthesized turns). Viewer footer has Delete + "Load as new thread". Load confirms when the live thread has messages (so the user doesn't lose unsaved work). Delete confirms.
- `src/App.tsx` — header gains `BookmarkPlus` (save snapshot) and `Library` (snapshots list) buttons. Save button only renders when the thread has messages (matches the existing trash icon). Snapshots button is always visible. App boot now also hydrates the snapshots store.

**Verified:** `npm run build` passes. `npm run smoke` still passes (8 + 3). Dev server boots; the empty Snapshots dialog rendered correctly in Playwright. Full save/view/load/delete round-trip wasn't run from this session because it requires creating real messages (i.e. real API keys); the build typing + the empty-state path cover the wiring.

**Notes for the next phase:**
- `loadFromSnapshot` reassigns IDs but reuses the original `createdAt` timestamps. If you ever need to insert a snapshot mid-thread later, that ordering will need rethinking.
- `Snapshot.messages` is stored as a JSON-y blob in Dexie. If image content blocks (Phase 7) get large, consider splitting attachments to a separate store. Not a problem for text-only Phase 6.

### Phase 7 (vision + web search + thinking) — verified at build + smoke + browser empty-state
- `src/state/thread.ts` — `sendMessage(text, options?: SendOptions)` now accepts `{ images?, webSearch? }`. Builds the user message's `content` as `[textBlock?, ...imageBlocks]`. Empty text + zero images → no-op. `runStream` extended with optional `webSearch` (passed as `webSearchEnabled` to `streamProvider`); relay/synthesize don't carry web search forward — they explicitly omit it (per-message decision per locked spec).
- `src/components/Chat/Message.tsx` — bubble now renders image content blocks as a flex-wrap thumbnail row above the text. User and assistant message bubbles both handle mixed content. Empty-text user bubbles (image-only) hide the `<p>` so we don't render a phantom blank paragraph.
- `src/components/Chat/PromptBar.tsx` — gained: hidden `<input type="file" accept="image/*" multiple>`, a `Paperclip` attach button, an attachment thumbnail row above the textarea with `×` per image, and a `Globe` web-search toggle button (uses `aria-pressed` + `secondary` variant when on; resets to off after each send). Files are converted via `FileReader.readAsDataURL` and split into `mediaType` + base64 `data` (matching the `ContentBlock` shape consumed by both providers). Send is enabled when text OR images are present.
- Thinking block (`ThinkingBlock.tsx`) was already wired in Phase 4 and needs no change. Settings exposes `thinkingOn` (the `thinkingBudget` field was removed in Phase 10). The `▸ Thinking` expander renders any time Claude streams `thinking-delta` events.

**Verified:** `npm run build` passes. `npm run smoke` still passes. Dev server boots; PromptBar renders with attach + globe + model toggle and 0 console errors. Real image upload + web search end-to-end was not run — it requires the user's API keys and is a pure-UI extension of the already-verified Phase 4 streaming path. Provider request shapes for both `image` blocks and search params were implemented in Phase 3 and are exercised by `npm run smoke`.

**Notes for the next phase:**
- Web-search toggle is *per-message and resets to off after send*, matching the locked spec. If we ever want a "sticky" toggle, persist it in settings; for now the reset is intentional.
- Image storage is in-message base64. Snapshots will carry images as part of `Snapshot.messages` (Dexie blob). Watch the IndexedDB size if Ilias attaches many large images — we may want to downscale at attach time later.
- xAI's image_url path uses `data:${mediaType};base64,${data}` (see `xai.ts:67-73`) which works for both browser and Capacitor.

### Phase 8 (theme + copy-as-markdown) — verified at build + smoke
- `src/lib/threadMarkdown.ts` — new module. `messageToMarkdown(message)` returns the body with an optional origin line (`_↻ relayed from Claude_` / `_✦ synthesizing Grok_`) and an attachment note (`_[2 images attached]_`) prepended. `threadToMarkdown(messages)` wraps each message with `**You:**` / `**Claude:**` / `**Grok:**` headings and joins them with `---` rules.
- `src/components/Chat/Message.tsx` — added a `Copy` icon button to the action row using `navigator.clipboard.writeText(messageToMarkdown(message))`. The action row now renders for *both* user and assistant messages (gated on `text.length > 0 && !readOnly && !showCursor`); on user messages the row contains only the Copy button. Icon swaps to `Check` for 1.5s after a successful copy.
- `src/App.tsx` — header gains a `Copy` icon button (rendered when `hasMessages`) wired to `threadToMarkdown(useThread.getState().messages)`. Same Check-icon flash pattern.
- Theme path was confirmed unchanged from Phase 2 (light / dark / system; persisted in Dexie; live-updates via `watchSystemTheme`). No code change.

**Verified:** `npm run build` passes. `npm run smoke` still passes. Dev server still boots cleanly. End-to-end clipboard verification (paste into a markdown viewer to confirm formatting) wasn't run from this session — needs a real thread which needs API keys.

**Notes for the next phase:**
- `messageToMarkdown` deliberately renders attached images as a `_[N images attached]_` note rather than embedding base64 in the markdown — paste targets (Slack, Notion, etc.) don't render data-URI images well, and the user usually wants the words. If we ever want full fidelity, we can switch to `![](data:...)` in a future opt-in mode.
- The header is getting busy when `hasMessages` is true (Copy / Save snapshot / Trash / Snapshots / Settings = 5 buttons). If Ilias finds it cluttered, consolidate Copy + Save + Trash into a `dropdown-menu` triggered by a single 3-dot icon. The shadcn primitive is already imported (`@/components/ui/dropdown-menu`).
- Per-message copy on user bubbles emits raw text — the body the user typed, with origin caption preserved so relay/synthesize bubbles remain self-explanatory in the paste target.

### Phase 9 (Capacitor wrap) — code done in this session; native bringup pending
What's in place:
- `package.json` — added runtime deps `@capacitor/core`, `@capacitor/preferences`, `@capacitor/camera` and dev deps `@capacitor/cli`, `@capacitor/ios`. `npm install` is committed via `package-lock.json`.
- `capacitor.config.ts` — repo root. App id `com.iamilias.ai4me`, app name `ai4me`, `webDir: 'dist'`. Edit the bundle id if you want a different one before `cap add ios`.
- `src/lib/storage/keys.ts` — exports a `KeyStore` whose impl is selected at runtime. Browser → localStorage. Capacitor (iOS) → `@capacitor/preferences`. Same `ai4me:secret:` prefix on both. Callsites unchanged.
- `src/components/Chat/PromptBar.tsx` — the Paperclip button now branches on `Capacitor.isNativePlatform()`. On native it calls `Camera.getPhoto({ source: CameraSource.Prompt, resultType: CameraResultType.Base64, quality: 90 })` and converts the returned `{ base64String, format }` into the existing `AttachedImage` shape. On web it still triggers the hidden `<input type="file" multiple>`. Multi-attach on iOS works via repeated taps (camera plugin returns one image per call).

**Verified:** `npm run build` passes (Capacitor packages tree-shake on web; `Capacitor.isNativePlatform()` returns `false` in the browser, so the Preferences and Camera branches are dead-code-eliminated for the web bundle in practice). `npm run smoke` still passes. Dev server still boots cleanly with no console errors.

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

### Phase 11 (three-way model picker: Fable / Opus / Grok 4.6) — 2026-09-12

- `src/lib/models.ts` — new. Curated model list and helpers: `CLAUDE_MODELS` (`claude-fable-5` → "Fable", `claude-opus-5` → "Opus"), `GROK_MODELS` (`grok-4.6` → "Grok 4.6"), `isFableModel(id)`, `composerFromState(provider, claudeModel)` → `'fable' | 'opus' | 'grok'`, `modelIdForComposer`, and `modelLabel(model, provider)` (falls back to "Claude"/"Grok" for legacy messages with no `model`).
- `src/components/Chat/PromptBar.tsx` — the Claude/Grok segmented toggle is replaced by a shadcn `Select` with three options. Fable and Opus both set `currentModel = 'claude'` and write `claudeModel` to settings; Grok sets `currentModel = 'grok'`. Placeholder copy uses the composer label.
- `src/components/Settings/SettingsDialog.tsx` — Claude and Grok model fields are now Selects over the curated lists; a stored ID that isn't in the list is shown as an extra option so custom/legacy values survive. Empty-value fallbacks are `CLAUDE_FABLE_ID` / `GROK_46_ID`. Thinking toggle relabelled "Extended thinking (Opus)" with the note that Fable always thinks.
- `src/lib/storage/db.ts` — `ThreadMessage.model?: string` (additive, no schema bump). Defaults moved to `claudeModel: 'claude-fable-5'`, `grokModel: 'grok-4.6'`. `loadSettings()` maps a stored `grok-4-latest` forward to `grok-4.6` at read time (same pattern as the existing `claude-opus-4-7` → `claude-opus-5` mapping).
- `src/state/thread.ts` — every assistant placeholder (send / relay / synthesize / debate) records `model` so labels are stable even after the settings default changes.
- `src/lib/providers/anthropic.ts` — `buildAnthropicRequest` omits the `thinking` field entirely for Fable models: Fable rejects both `{ type: 'disabled' }` and budget thinking with 400, and thinks adaptively on its own. Opus keeps the Phase 10 adaptive/disabled behaviour.
- `src/components/Chat/Message.tsx`, `src/lib/threadMarkdown.ts`, `src/lib/export/briefing.ts` — speaker labels come from `modelLabel(model, provider)`, so bubbles, copied markdown, and the HTML/PDF briefing say "Fable" / "Opus" / "Grok" (legacy messages without `model` still say "Claude" / "Grok").
- `scripts/providers-smoke.ts` — two new assertions: Fable request has no `thinking` field whether the toggle is on or off. `scripts/export-smoke.ts` — six new assertions for `composerFromState` and `modelLabel`.

**Verified:** `npm run build` passes. `npm run smoke` passes (SSE + providers + export). Real-key check is manual: send with Fable selected → streams with a thinking block and no 400; switch to Opus → toggle thinking off → still streams; bubble labels read Fable / Opus / Grok.

**Notes for the next phase:**
- `models.ts` is the single place to bump model IDs or add a tier. The Settings Select and the composer both read from it.
- `modelLabel` is prefix-based (`claude-fable*`, `claude-opus*`, `grok*`), so dated model IDs (e.g. `claude-opus-5-20260401`) label correctly without code changes.

### Phase 12 (short cross-model turns + collapsed debate + live debate tracker) — 2026-09-12

Problem: each model answered with 300–400+ words, so a 3-round debate was ~8 essays plus verbatim prompt bubbles — unreadable. Fix at the prompt (the real lever) and in the UI, and keep the debate watchable while it runs.

- `src/lib/prompts.ts` — new. The four cross-model prompt builders moved here from `thread.ts` (pure, smoke-testable). `debateOpenPrompt` / `debateReplyPrompt` append `DEBATE_TURN_RULES` (under 150 words, one-sentence verdict first, ≤3 bullets, no restating). `synthesizePrompt` caps at ~200 words; `debateSynthesisPrompt` has a soft ~300-word cap (the synthesis is the deliverable). `lengthInstruction(replyLength)` + `composeSystemPrompt(userPrompt, replyLength)` join the user's system prompt with a length instruction; returns `''` when both are empty so providers keep omitting `system`.
- `src/lib/storage/db.ts` — `ReplyLength = 'concise' | 'standard' | 'detailed'`; `replyLength` on `SettingsRow`, default `'standard'` (= today's behaviour). Additive, merged at read, no schema bump.
- `src/state/settings.ts` — `replyLength` in state / hydrate / defaults.
- `src/state/thread.ts` — `runStream` sends `composeSystemPrompt(settings.systemPrompt, settings.replyLength)`. New `debate: DebateState | null` (`startIndex`, `turn`, `total`, `target`, `phase: 'exchange' | 'synthesis'`) set by `debateMessage` at the top of each iteration and cleared in `finally` / `cancel` / `clear` / `loadFromSnapshot`. `isDebating` is unchanged.
- `src/components/Settings/SettingsDialog.tsx` — Behavior → "Reply length" Select (Concise / Standard / Detailed), helper "Applies to every turn. Debate exchanges are always kept short."
- `src/lib/messageText.ts` — helpers: `isDebateTurn(messages, i)` (assistant reply whose previous message is a `debate` prompt; synthesis replies are not turns), `isDebatePrompt(m)`, `shouldCollapseDebateTurn(messages, i)` (fold only once a *later* assistant message has text — the turn being read stays open through the next model's connect/thinking gap), `firstParagraph(text)`, `firstSentence(text)` (strips headings/bullets/`**Verdict:**` labels).
- `src/components/Chat/Message.tsx` — `collapsed` prop. Foldable turns render `firstParagraph` + "Show more" / "Show less" (user toggle overrides the prop; streaming turns always render in full). Debate prompt bubbles (`debate` / `debate-synthesis` origins) render only their caption plus a "show prompt" link — the boilerplate and the verbatim source copy are hidden; the action row is hidden with them. Relay/synthesize prompt bubbles unchanged. Copy still copies the full text. `ThinkingBlock` gets `autoOpen={showCursor && !text}`.
- `src/components/Chat/ThinkingBlock.tsx` — `autoOpen` prop: open while true, folds when text starts; a manual click takes over. Body capped at `max-h-64` with scroll.
- `src/components/Chat/MessageList.tsx`, `src/components/Snapshots/SnapshotsDialog.tsx` — pass `collapsed={shouldCollapseDebateTurn(list, i)}`.
- `src/components/Chat/DebateTracker.tsx` — new strip between the list and the composer while `debate` is set: header `⚔ Debate · round N of M · Grok challenging Claude` (or `✦ Closing synthesis · Fable`) with step dots; live status derived from the streaming message (`reading…` → `thinking…` → `writing…`); one headline per completed turn (`Grok: <first sentence>`) — with verdict-first prompts this reads as a live scoreboard. On a synthesis-completed end it shows `✦ Debate finished · N exchanges` for 4 s; Stop/error hide it at once. Mounted in `ChatView`.
- `scripts/prompts-smoke.ts` — new (registered in `npm run smoke`): system-prompt composition, prompt rule presence/absence, `firstParagraph` / `firstSentence`, debate-turn detection and the fold rule (streaming placeholder never folds; last finished turn stays open while the next is empty).
- `.claude/launch.json` — `relay-dev` (npm run dev, port 5173) for the desktop-app browser pane.

**Verified:** `npm run build`; `npm run smoke` (77 cases); browser with a seeded 8-message debate thread in IndexedDB — debate turns folded to their verdict line with Show more, prompt bubbles reduced to captions with show prompt, conclusion fully open, Settings shows Reply length. The tracker strip and prompt-length effect need real keys (manual): start a debate → strip shows round dots + reading/thinking/writing, thinking streams live in the empty bubble, each exchange is ≤ ~150 words and its verdict appears as a headline, a finished turn folds only when the next reply starts, "Debate finished" flashes at the end; Reply length → Concise shortens normal replies.

**Notes for the next phase:**
- Headlines are only as good as the verdict-first instruction; if a model ignores it, `firstSentence` still returns its first sentence.
- Possible follow-ups: fold a whole debate into one card showing only the synthesis; provider colour-coding on bubbles; a `max_tokens` cap on xAI requests (none today).

### Phase 13 (Synthesize = best of both when both models have spoken) — 2026-09-12

"Synthesize" on a single-source thread was really "critique and improve". Now, when the model being asked has already answered earlier in the thread, the button merges both views instead.

- `src/lib/prompts.ts` — `mergePrompt(from, fromBody, self, selfBody)` + `MERGE_RULES`: quotes the other model's answer and the responder's own most recent answer, asks for one sentence on agreement/difference, then the single best answer (keep the strongest points from each, resolve disagreements explicitly, drop what doesn't hold up); under ~250 words. `synthesizePrompt` (critique + improve) is unchanged and still used when only one model has spoken.
- `src/lib/messageText.ts` — `lastSpokenBody(messages, provider, before)`: body of that provider's most recent non-empty assistant turn before an index, or `null`.
- `src/state/thread.ts` — `synthesizeMessage` picks `mergePrompt` + origin kind `merge` when `lastSpokenBody(all, otherProvider, sourceIdx)` is non-null, else the old path with origin `synthesize`.
- `src/lib/storage/db.ts` — origin kind union gains `'merge'` (additive).
- Captions: `✦ merging with Grok` in `Message.tsx`, `_✦ merging with Grok_` in `threadMarkdown.ts`, and the HTML briefing.
- `src/components/Chat/Message.tsx` — Sparkles button label/tooltip reads `Merge with Fable: best of both` when both have spoken, else `Ask Fable to synthesize` (selector via `lastSpokenBody`).
- Smoke: `prompts-smoke.ts` covers `mergePrompt` content and `lastSpokenBody`; `export-smoke.ts` checks the merge caption in the briefing.

**Verified:** `npm run build` + `npm run smoke`. Manual with real keys: ask a question → Claude answers → Relay to Grok → on Grok's bubble the Sparkles tooltip says "Merge with Fable: best of both" → click → caption `✦ merging with Grok`, reply opens with where they agree/differ and gives one merged answer. On a thread where only Grok has spoken, the tooltip and behaviour are the old critique path.

### Phase 14 (cover-aligned restyle) — 2026-09-12

The app now matches the site's cover page for Relay (black, heavy `RELAY`, thin grey tracked-caps labels, hairline rule, square outlined button, sparse static stars). Skin only — no behaviour, state, export, or smoke-logic changes. An earlier "psychedelic / iridescent / motion" direction was tried the same day, rejected by Ilias, and fully reverted before commit; don't reintroduce colour or ambient motion.

- `src/index.css` — palette: dark = `#000` / `#f2f2f2` / labels `#8c8c8c` / hairlines `rgba(255,255,255,.14)`; light = exact inversion. `--muted` is transparent (assistant boxes are hairline-only), `--primary` is a 6%/4% tint (user boxes), `--radius` is 2px. `body::before` paints nine static 1px stars (`--star`). New `.label` utility: 11px, `letter-spacing .22em`, uppercase, weight 400, grey. Base weights: body 300, `strong` 500, headings 400.
- `src/App.tsx` — wordmark `RELAY` (800, tight tracking); shell is `relative z-10` over the stars; header padding widened.
- `src/components/Chat/Message.tsx` — boxes are `rounded-[2px] border`; assistant transparent, user `bg-primary`. Model name, origin captions, show/hide prompt, Show more/less use `.label`. Chat captions lost their glyphs (`debating Grok`, `debate conclusion`, …) — **exports keep them** (`threadMarkdown.ts`, `briefing.ts` untouched; export-smoke asserts them). Caret is a 1px bar.
- `src/components/Chat/PromptBar.tsx` — borderless textarea; Send/Stop are `variant="outline"` with `.label` text and a 50% foreground border; Select trigger uses `.label`.
- `src/components/Chat/DebateTracker.tsx`, `ThinkingBlock.tsx`, `MessageList.tsx` — `.label` on headers/status/toggles; tracker dots are squares (filled done, outlined pending, pulsing active); empty-state title is a label.
- `src/lib/markdown.tsx` — 15px / 1.7 / 300; strong 500; headings 400; 2px radii.
- `src/components/ui/button.tsx` — `default` variant is now an outlined hairline (transparent, `border-border`, hover `bg-accent`); `font-medium` → `font-normal`. `dialog.tsx` / `select.tsx` / `dropdown-menu.tsx` — solid `bg-popover`, `ring-border`, no shadow; dialog radius 2px, overlay 40% black.
- Settings / Snapshots dialogs — titles and section `h3`s use `.label`.

**Verified:** `npm run build`; `npm run smoke` (87); seeded 8-message debate thread in the browser pane — dark and light, desktop and 375px (no horizontal scroll); Settings dialog. Contrast: `#f2f2f2`/`#000` and `#0a0a0a`/`#fff` ≫ 4.5:1; labels `#8c8c8c`/`#000` ≈ 5.9:1.

**Notes:** the `.label` class is the one knob for the micro-type; change tracking/size there. If the stars ever read as dirt on a particular display, drop `body::before`.

### Phase 15 (API key fields: masked chip + live "valid key" check) — 2026-09-12

The Settings key inputs were wide password fields that filled with dozens of dots. Now each key is a narrow prefix-hinted input that collapses into a masked chip with a live verdict.

- `src/lib/apiKeys.ts` — `KeyProvider`, `KEY_PREFIX` (`sk-ant-` / `xai-`), `keyLooksValid()` (prefix + ≥20 `[A-Za-z0-9_-]`), `maskKey()` → `sk-ant-…3f9a` (prefix + last 4, never more).
- `src/lib/providers/verify.ts` — `verifyApiKey(provider, key, signal)`: free `GET /v1/models` on each provider with the same headers the streaming code uses. 2xx → `ok`, 401/403 → `rejected`, xAI's 400 "Incorrect API key provided" → `rejected`, anything else → `unreachable` (so a good key is never shown as bad because of a flaky network / CORS hiccup).
- `src/components/Settings/ApiKeyField.tsx` — the field. Empty/editing: `max-w-xs` mono text input, placeholder `sk-ant-…`, grey hint "Anthropic keys start with sk-ant-" while the shape doesn't match. Well-formed value (typed, pasted, or hydrated): chip with check icon + masked key, status line, `REPLACE` label-button. Status: checking (grey pulsing) → "Valid API key" (green `text-emerald-500` — the one semantic colour in the monochrome UI) / "Anthropic rejected this key" (red X, destructive border) / "Key entered — could not reach Anthropic to verify" (grey). 300 ms debounce, AbortController on change. Verification is UI-only; Save still calls `setApiKey()` with the trimmed value; Cancel discards.
- `src/components/Settings/SettingsDialog.tsx` — the two `Input` blocks replaced by `<ApiKeyField>`; local state and `handleSave` unchanged.
- `scripts/providers-smoke.ts` — 11 cases for `keyLooksValid` / `maskKey`.

**Verified:** `npm run build`; `npm run smoke`; browser pane: empty → narrow inputs; junk → hint; dummy well-formed key → chip + "rejected" (401); Replace reopens; the full key never renders. Real-key green check is manual (Ilias).

## Phase 9 — remaining manual steps (Ilias, at your Mac)

These need a physical iPhone, Xcode, and CocoaPods — out of scope for the AI session.

```sh
# 1. Build the web app so Capacitor has something to wrap
npm run build

# 2. Generate the iOS native project (one-time)
npx cap add ios

# 3. After every web change: rebuild + sync
npm run build && npx cap sync ios
```

Then in `ios/App/App/Info.plist`, add the camera + photo-library usage descriptions Apple requires:

```xml
<key>NSCameraUsageDescription</key>
<string>ai4me lets you attach photos to chat with Claude or Grok.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>ai4me lets you attach photos from your library.</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>ai4me does not save photos.</string>
```

Open Xcode:

```sh
npx cap open ios
```

In Xcode:
1. Select the `App` target → Signing & Capabilities → set your Apple ID team.
2. Plug in the iPhone, choose it as the run target, hit ▶︎.
3. On the iPhone: Settings → General → VPN & Device Management → trust your developer profile.

### Verification on device
- App launches.
- Settings → paste both API keys. Force-close + reopen → keys persist (Capacitor Preferences, not localStorage).
- Send a Claude message → text streams in.
- Tap attach → "Take Photo or Choose from Library" picker → attach a photo → send → confirm vision works.
- Snapshots / Copy thread / Relay / Synthesize all behave the same as on web.

### Native-specific notes
- `anthropic-dangerous-direct-browser-access: true` is harmless on iOS — native HTTP bypasses CORS regardless. Keeping it for the shared web/native code path is fine.
- xAI calls also bypass CORS on iOS.
- `lib/storage/db.ts` (Dexie/IndexedDB) works as-is — Capacitor's WKWebView supports IndexedDB.
- The `@capacitor/ios` package is purely a marker for `cap add ios` — there is nothing to import from app code.

## Project layout (current)

```
ai4me/
├── HANDOFF.md                 ← this file
├── capacitor.config.ts        ← Capacitor app id / web dir (Phase 9)
├── components.json            ← shadcn config (radix, nova preset)
├── eslint.config.js
├── index.html                 ← title set to "ai4me"
├── package.json
├── public/
│   └── favicon.svg
├── src/
│   ├── App.tsx                ← header + gear button + dialog mount
│   ├── components/
│   │   ├── Chat/
│   │   │   ├── ChatView.tsx
│   │   │   ├── DebateTracker.tsx  ← live debate strip (rounds, status, headlines)
│   │   │   ├── Message.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── PromptBar.tsx
│   │   │   └── ThinkingBlock.tsx
│   │   ├── Export/
│   │   │   └── ExportMenu.tsx  ← copy / .md / .html / .pdf dropdown (header)
│   │   ├── Settings/
│   │   │   ├── ApiKeyField.tsx    ← masked key chip + live verify (Phase 15)
│   │   │   └── SettingsDialog.tsx
│   │   ├── Snapshots/
│   │   │   ├── SaveSnapshotDialog.tsx
│   │   │   └── SnapshotsDialog.tsx
│   │   └── ui/                ← shadcn components (don't edit unless intentional)
│   ├── index.css              ← tailwind import + nova theme vars
│   ├── lib/
│   │   ├── export/
│   │   │   ├── briefing.ts    ← HTML briefing builder (marked)
│   │   │   └── download.ts    ← blob download + PDF via html2canvas/jspdf
│   │   ├── apiKeys.ts         ← key shape check + masking
│   │   ├── providers/
│   │   │   ├── anthropic.ts   ← Messages API streaming
│   │   │   ├── verify.ts      ← GET /v1/models key check
│   │   │   ├── xai.ts         ← OpenAI-shape streaming
│   │   │   ├── types.ts       ← ProviderMessage, StreamEvent, etc.
│   │   │   └── index.ts       ← streamProvider() dispatcher
│   │   ├── storage/
│   │   │   ├── db.ts          ← Dexie schema + helpers
│   │   │   └── keys.ts        ← swappable secret store
│   │   ├── markdown.tsx       ← react-markdown + remark-gfm wrapper
│   │   ├── messageText.ts     ← textOf(message) helper, shared
│   │   ├── models.ts          ← curated model IDs + labels (Fable / Opus / Grok 4.6)
│   │   ├── prompts.ts         ← cross-model prompt builders + reply-length system prompt
│   │   ├── sse.ts             ← parseSSEStream() async generator
│   │   ├── theme.ts           ← applyTheme() / watchSystemTheme()
│   │   ├── threadMarkdown.ts  ← messageToMarkdown / threadToMarkdown helpers
│   │   └── utils.ts           ← shadcn cn() helper
│   ├── state/
│   │   ├── settings.ts        ← Zustand store (hydrated from db + keys)
│   │   ├── snapshots.ts       ← Zustand store (saved threads, hydrated from db)
│   │   └── thread.ts          ← Zustand store (messages, streaming, currentModel)
│   └── main.tsx
├── scripts/
│   ├── alias-loader.mjs       ← Node ESM hook for @/ + relative imports (smoke tests only)
│   ├── sse-smoke.ts           ← parseSSEStream cases
│   ├── providers-smoke.ts     ← streamAnthropic / streamXai event mapping + request shapes
│   ├── export-smoke.ts        ← briefing / filename / model-label cases
│   ├── prompts-smoke.ts       ← prompt rules, system-prompt composition, fold rule
│   └── make-app-icon.py       ← generates the iOS AppIcon PNG
├── tsconfig.json              ← paths only, no baseUrl
├── tsconfig.app.json          ← paths only, no baseUrl
├── tsconfig.node.json
└── vite.config.ts             ← react + tailwindcss plugins, @ alias
```

## Conventions

- Don't add `baseUrl` back — TS 7 deprecates it; `paths` works alone.
- Don't install vendor SDKs (`@anthropic-ai/sdk`, `openai`). Hand-rolled `fetch` is intentional for browser + Capacitor portability.
- Don't add a backend, key proxy, or auth layer. Decision is locked: pure client-side, BYO keys.
- Keep components small and focused — the plan calls out specific files for each concern (Chat/Message.tsx, Chat/PromptBar.tsx, Snapshots/SnapshotList.tsx, etc.).
- Tailwind v4 syntax — use `@theme inline { ... }` and CSS variables, not the v3 `tailwind.config.js` approach. shadcn nova preset already wired this in `src/index.css`.

## Open question for the user (deferred)

None blocking. The web app is feature-complete; iOS native bringup is the only remaining work and is gated on hardware/Xcode access.
