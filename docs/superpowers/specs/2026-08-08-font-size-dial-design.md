# Font size dial in Settings — design

Date: 2026-08-08
Status: approved (approach A)

## Purpose

Let the user scale the entire app's text — messages, header, composer, dialogs — from a dial in Settings, like iOS Dynamic Type. Persisted per device alongside the other settings.

## Approach

Root font-size scaling. All sizing in the app is rem-based (Tailwind), so setting a percentage
font-size on `<html>` scales the whole UI coherently. Chosen over a preset Select (not a dial,
too coarse) and over message-only scaling (user chose whole-app).

## Behavior

- Dial: a slider in the Appearance section of the Settings dialog, below Theme.
- Range **85%–130% in 5% steps**; label shows the live value ("Font size · 110%").
- **Live preview:** dragging applies the scale to the document immediately.
- **Cancel/dismiss** reverts to the last saved value. **Save** persists it.
- Default 100%; existing installs migrate for free (defaults merge in `loadSettings`).

## Components

| Unit | Change |
|---|---|
| `src/lib/storage/db.ts` | `fontScale: number` on `SettingsRow`, `fontScale: 1` in `SETTINGS_DEFAULTS`. No schema bump (out-of-line field, defaults merged at read). |
| `src/lib/theme.ts` | `applyFontScale(scale: number)`: sets `document.documentElement.style.fontSize = scale === 1 ? '' : `${scale * 100}%``. Percentage of the UA base respects user browser settings. |
| `src/state/settings.ts` | `fontScale` in state, hydrate, defaults — same shape as `debateRounds`. |
| `src/App.tsx` | Apply `fontScale` in the existing appearance effect alongside `applyTheme`. |
| `src/components/ui/slider.tsx` | New shadcn slider on the consolidated `radix-ui` package's `Slider` primitive (same import idiom as `dialog.tsx`). |
| `src/components/Settings/SettingsDialog.tsx` | Local `fontScale` state (hydrate on open like other fields); Slider wired to it; effect applies live preview while open and re-applies the store value on close-without-save; `handleSave` includes `fontScale` (clamped 0.85–1.3). |

## Data flow

Slider drag → dialog local state → `applyFontScale` (preview) → Save → `updateSettings({ fontScale })` → Dexie + store → App effect re-applies (idempotent). Cancel → close effect re-applies store value.

## Error handling

`fontScale` clamped to [0.85, 1.3] at save (mirrors the `debateRounds` clamp); non-finite stored values fall back to 1 at apply time.

## Testing

No test infra in the repo (convention: build + manual verification).
1. `npm run build` passes.
2. Browser at 402x874: drag dial → whole UI scales live; Cancel reverts; Save + reload persists; pinned shell (header/composer) and Settings dialog max-height still correct at 130%.
3. `npx cap sync ios`, rebuild, relaunch on the iPhone 17 Pro simulator.
