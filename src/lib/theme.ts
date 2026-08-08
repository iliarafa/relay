import type { Theme } from '@/lib/storage/db'

const MEDIA = '(prefers-color-scheme: dark)'

export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia(MEDIA).matches)
  root.classList.toggle('dark', isDark)
}

export function watchSystemTheme(getTheme: () => Theme): () => void {
  const mql = window.matchMedia(MEDIA)
  const handler = () => {
    if (getTheme() === 'system') applyTheme('system')
  }
  mql.addEventListener('change', handler)
  return () => mql.removeEventListener('change', handler)
}

export function applyFontScale(scale: number): void {
  const root = document.documentElement
  root.style.fontSize = Number.isFinite(scale) && scale !== 1 ? `${scale * 100}%` : ''
}
