# Font Size Dial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A slider in Settings → Appearance that scales the whole app's text 85%–130%, live-previewed, persisted per device.

**Architecture:** Root font-size scaling — `document.documentElement.style.fontSize = '<n>%'`. All app sizing is rem-based (Tailwind), so one root percentage scales everything coherently. `fontScale` rides the existing settings pipeline (Dexie row → Zustand → App effect), same shape as `theme`/`debateRounds`.

**Tech Stack:** React 19, Zustand, Dexie, Tailwind v4, consolidated `radix-ui` package (already a dependency; exports `Slider`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-08-font-size-dial-design.md`
- Range 85%–130%, step 5%, default 100% (`fontScale: 1`, stored as a float 0.85–1.3)
- Live preview while the dialog is open; Cancel/dismiss reverts; Save persists
- No new dependencies; no Dexie schema bump (defaults merge in `loadSettings`)
- No test infra in this repo — verification is `npm run build` + browser + simulator (repo convention)
- Repo commit style: one feature-level commit, lowercase `feat:` subject, trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Settings plumbing — store, apply, wire

**Files:**
- Modify: `src/lib/storage/db.ts` (SettingsRow ~line 10, SETTINGS_DEFAULTS ~line 61)
- Modify: `src/lib/theme.ts` (append)
- Modify: `src/state/settings.ts` (interface ~line 12, initial state ~line 30, hydrate ~line 49)
- Modify: `src/App.tsx` (selector ~line 33, effects ~line 46)

**Interfaces:**
- Consumes: existing `SETTINGS_DEFAULTS`, `loadSettings` merge behavior, `useSettings` store shape.
- Produces: `SettingsRow.fontScale: number`; `applyFontScale(scale: number): void` exported from `@/lib/theme`; `useSettings` state field `fontScale: number`. Task 3 relies on all three names exactly.

- [ ] **Step 1: Add the field to the row type and defaults** — in `src/lib/storage/db.ts`:

```ts
// in interface SettingsRow, after debateRounds:
  debateRounds: number
  fontScale: number
  theme: Theme

// in SETTINGS_DEFAULTS, after debateRounds:
  debateRounds: 3,
  fontScale: 1,
  theme: 'system',
```

- [ ] **Step 2: Add `applyFontScale` to `src/lib/theme.ts`** (append after `watchSystemTheme`):

```ts
export function applyFontScale(scale: number): void {
  const root = document.documentElement
  root.style.fontSize = Number.isFinite(scale) && scale !== 1 ? `${scale * 100}%` : ''
}
```

- [ ] **Step 3: Thread `fontScale` through the Zustand store** — in `src/state/settings.ts`:

```ts
// in interface SettingsState, after debateRounds:
  debateRounds: number
  fontScale: number

// in the initial state, after debateRounds:
  debateRounds: SETTINGS_DEFAULTS.debateRounds,
  fontScale: SETTINGS_DEFAULTS.fontScale,

// in hydrate()'s set({...}), after debateRounds:
      debateRounds: row.debateRounds,
      fontScale: row.fontScale,
```

- [ ] **Step 4: Apply on hydrate/change in `src/App.tsx`** — extend the import, add a selector next to `theme`, add a sibling effect after the theme effect:

```ts
import { applyFontScale, applyTheme, watchSystemTheme } from '@/lib/theme'

  const fontScale = useSettings((s) => s.fontScale)

  useEffect(() => {
    if (!settingsHydrated) return
    applyFontScale(fontScale)
  }, [settingsHydrated, fontScale])
```

- [ ] **Step 5: Verify** — run `npm run build`; expected: passes (tsc catches any missed wiring — the exhaustive `SettingsRow` spread sites make missing fields type errors).

### Task 2: Slider UI component

**Files:**
- Create: `src/components/ui/slider.tsx`

**Interfaces:**
- Consumes: `Slider` primitive from the consolidated `radix-ui` package (same import idiom as `src/components/ui/dialog.tsx`: `import { Slider as SliderPrimitive } from "radix-ui"`), `cn` from `@/lib/utils`.
- Produces: `<Slider min max step value={[n]} onValueChange={([n]) => …} />` — standard shadcn slider API (array-valued). Task 3 imports `{ Slider }` from `@/components/ui/slider`.

- [ ] **Step 1: Create `src/components/ui/slider.tsx`** — stock shadcn v4 slider, import adapted to the consolidated package:

```tsx
import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max]
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="bg-muted relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className="border-primary bg-background ring-ring/50 block size-4 shrink-0 rounded-full border shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
```

- [ ] **Step 2: Verify** — run `npm run build`; expected: passes.

### Task 3: Dialog wiring — dial, live preview, save, revert

**Files:**
- Modify: `src/components/Settings/SettingsDialog.tsx` (imports ~line 1-24, state ~line 40, hydrate effect ~line 44, handleSave ~line 62, Appearance section ~line 189)

**Interfaces:**
- Consumes: `applyFontScale` from `@/lib/theme` (Task 1), `Slider` from `@/components/ui/slider` (Task 2), `useSettings` field `fontScale` (Task 1).
- Produces: user-facing dial; `updateSettings({ fontScale })` on Save.

- [ ] **Step 1: Imports and local state** — add to the existing import block and state:

```ts
import { Slider } from '@/components/ui/slider'
import { applyFontScale } from '@/lib/theme'

  const [fontScale, setFontScale] = useState(settings.fontScale)
```

- [ ] **Step 2: Hydrate on open** — in the existing `useEffect` that copies store → local state on `open`, add:

```ts
    setFontScale(settings.fontScale)
```

- [ ] **Step 3: Live preview + revert effects** — add after the hydrate effect:

```ts
  useEffect(() => {
    if (!open) return
    applyFontScale(fontScale)
  }, [open, fontScale])

  useEffect(() => {
    if (open) return
    applyFontScale(useSettings.getState().fontScale)
  }, [open])
```

(Close after Save re-applies the just-saved store value; close after Cancel re-applies the old one. Runs once harmlessly on mount.)

- [ ] **Step 4: Persist on Save** — in `handleSave`'s `updateSettings` patch, after `debateRounds`:

```ts
          fontScale:
            Number.isFinite(fontScale)
              ? Math.min(Math.max(fontScale, 0.85), 1.3)
              : 1,
```

- [ ] **Step 5: The dial** — in the Appearance `<section>`, after the Theme select's closing `</div>`:

```tsx
            <div className="grid gap-2">
              <Label htmlFor="font-scale">Font size · {Math.round(fontScale * 100)}%</Label>
              <Slider
                id="font-scale"
                min={0.85}
                max={1.3}
                step={0.05}
                value={[fontScale]}
                onValueChange={([v]) => setFontScale(Math.round(v * 100) / 100)}
              />
            </div>
```

- [ ] **Step 6: Build** — `npm run build`; expected: passes.

- [ ] **Step 7: Browser verification** — dev server on port 8081 (`.claude/launch.json` + preview, per run-dev-server skill), viewport 402x874:
  - Open Settings → Appearance shows "Font size · 100%" with the dial.
  - Drag to 130%: all text (header, dialog, composer) visibly larger immediately; `getComputedStyle(document.documentElement).fontSize` ≈ `20.8px`.
  - Cancel → computed root font-size back to `16px`.
  - Set 115% + Save → persists; reload page → still ≈ `18.4px`; dialog reopens showing 115%.
  - At 130%: pinned shell intact (header top 0, composer bottom = viewport, document not scrollable); Settings dialog still fits (`max-h-[85dvh]`) and its middle scrolls.
  - Reset to 100% + Save → root font-size back to `16px` / inline style cleared.
  - Clean up any test state; stop server; remove `.claude/launch.json`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/storage/db.ts src/lib/theme.ts src/state/settings.ts src/App.tsx src/components/ui/slider.tsx src/components/Settings/SettingsDialog.tsx docs/superpowers/plans/2026-08-08-font-size-dial.md
git commit -m "feat: font size dial in settings — whole-app scaling via root font-size (85–130%), live preview

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Simulator** — `npx cap sync ios`, rebuild via the simulator build tool, relaunch on the iPhone 17 Pro, screenshot to confirm the dial renders and scaling applies on device.
