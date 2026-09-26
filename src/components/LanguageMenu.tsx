import { useEffect, useState, type KeyboardEvent } from 'react'
import { BR, CN, DE, ES, FR, IT, JP, NL, US } from 'country-flag-icons/react/3x2'
import { Dropdown } from '../ui'
import { LOCALES, useI18n } from '../i18n'
import { useSupportStore } from '../support/supportStore'

// Flag of each locale's reference region (see LOCALES.country) — a language is
// not a country, so this is a recognition aid beside the endonym, never a
// substitute for it. SVG components, not emoji: emoji flags render as two
// letters on Windows.
const FLAGS: Record<string, typeof US> = { BR, CN, DE, ES, FR, IT, JP, NL, US }

function Flag({ country }: { country: string }) {
  const Svg = FLAGS[country]
  if (!Svg) return null
  return <Svg aria-hidden="true" style={{ width: 18, height: 12, borderRadius: 2, flex: 'none' }} />
}

const ITEM_SELECTOR = '[role="menuitemradio"], [role="menuitem"]'

// Arrow keys move between languages, Home/End jump, Enter/Space choose (the
// items are buttons, so activation is native). Esc and Tab close the menu and
// return focus to the toggle (handled by Dropdown).
function moveFocus(menu: HTMLElement, key: string): boolean {
  const items = Array.from(menu.querySelectorAll<HTMLElement>(ITEM_SELECTOR))
  if (items.length === 0) return false
  const current = items.indexOf(document.activeElement as HTMLElement)
  let next: number
  if (key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % items.length
  else if (key === 'ArrowUp') next = current <= 0 ? items.length - 1 : current - 1
  else if (key === 'Home') next = 0
  else if (key === 'End') next = items.length - 1
  else return false
  items[next].focus()
  return true
}

/**
 * The language menu: closed, a globe with the current locale's flag and short
 * code (🌐 🇺🇸 EN); open, every supported language in its own name with its
 * flag, the current one checked. Choosing one switches immediately and
 * persists (see I18nProvider).
 */
export default function LanguageMenu() {
  const { locale, setLocale, t } = useI18n()
  const [open, setOpen] = useState(false)
  const current = LOCALES.find((option) => option.code === locale) ?? LOCALES[0]
  const openFeedback = useSupportStore((s) => s.openFeedback)

  // Opening moves focus to the current language. The menu is portaled and
  // revealed by Dropdown's layout effect, so this waits for that commit.
  useEffect(() => {
    if (!open) return
    const menu = document.querySelector<HTMLElement>('.kl-language-menu-list')
    const checked = menu?.querySelector<HTMLElement>(`${ITEM_SELECTOR}[aria-checked="true"]`)
    ;(checked ?? menu?.querySelector<HTMLElement>(ITEM_SELECTOR))?.focus()
  }, [open])

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (moveFocus(event.currentTarget, event.key)) event.preventDefault()
  }

  return (
    <Dropdown align="end" className="kl-language-menu ms-lg-2 my-2 my-lg-0" onToggle={setOpen}>
      <Dropdown.Toggle
        variant="outline-light"
        size="sm"
        aria-haspopup="menu"
        aria-label={t('choose_language')}
        title={t('choose_language')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
      >
        <span aria-hidden="true">🌐</span>
        <Flag country={current.country} />
        <span>{current.short}</span>
      </Dropdown.Toggle>
      <Dropdown.Menu
        role="menu"
        aria-label={t('choose_language')}
        className="kl-language-menu-list"
        onKeyDown={onMenuKeyDown}
        style={{ minWidth: 220 }}
      >
        {/* The languages are one radio group, delimited from Suggest Language by the
            separator (the ARIA menu pattern for radio items beside other items). */}
        <div role="group" aria-label={t('languages')}>
          {LOCALES.map((option) => {
            const selected = option.code === locale
            return (
              <Dropdown.Item
                key={option.code}
                role="menuitemradio"
                aria-checked={selected}
                active={selected}
                lang={option.code}
                onClick={() => setLocale(option.code)}
                style={{ display: 'flex', alignItems: 'center', gap: 10 }}
              >
                <Flag country={option.country} />
                <span style={{ flex: 1 }}>{option.label}</span>
                <span aria-hidden="true" style={{ visibility: selected ? 'visible' : 'hidden' }}>✓</span>
              </Dropdown.Item>
            )
          })}
        </div>
        {/* Always last, after a divider: the way to ask for a language KivaLens does
            not have yet (definition entryPoints.web_app.languageMenu; Paul,
            2026-09-25). Send Feedback opens on Language, already naming the
            browser's language when KivaLens lacks it. */}
        <div className="dropdown-divider" role="separator" />
        <Dropdown.Item
          role="menuitem"
          onClick={() => openFeedback({ kind: 'language' })}
          style={{ display: 'flex', alignItems: 'center', gap: 10 }}
        >
          {/* An empty flag-width column, so the words line up with the language names. */}
          <span aria-hidden="true" style={{ width: 18, flex: 'none' }} />
          <span>{t('suggest_language')}</span>
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  )
}
