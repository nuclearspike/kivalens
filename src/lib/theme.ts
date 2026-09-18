// Appearance: KivaLens follows the browser's prefers-color-scheme unless the
// lender picks light or dark in Options. The choice lives in localStorage and
// is mirrored onto <html data-theme>, which base/_theme.scss reads; "system"
// is stored as the absence of both. public/theme-init.js applies the same
// attribute before first paint.

export type ThemeChoice = 'system' | 'light' | 'dark'

export const THEME_STORAGE_KEY = 'kl_theme'

// Browser-chrome colour per theme: the page background (--kl-bg) of each.
const THEME_COLOR: Record<'light' | 'dark', string> = { light: '#ffffff', dark: '#121715' }

export function parseThemeChoice(raw: unknown): ThemeChoice {
  return raw === 'light' || raw === 'dark' ? raw : 'system'
}

export function readThemeChoice(): ThemeChoice {
  try {
    return parseThemeChoice(window.localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

export function saveThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY)
    else window.localStorage.setItem(THEME_STORAGE_KEY, choice)
  } catch {
    // Storage is unavailable: the choice still applies for this visit.
  }
}

export function applyThemeChoice(choice: ThemeChoice, doc: Document = document): void {
  const root = doc.documentElement
  if (choice === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', choice)

  // index.html carries one theme-color meta per scheme, each gated by a media
  // query. A forced theme paints both with its colour so the browser chrome
  // matches the page whichever query is active.
  doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"][data-kl-scheme]').forEach((meta) => {
    const own = meta.dataset.klScheme === 'dark' ? 'dark' : 'light'
    meta.content = THEME_COLOR[choice === 'system' ? own : choice]
  })
}
