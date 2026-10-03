// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { I18nProvider, LOCALES } from '../i18n'
import LanguageMenu from './LanguageMenu'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

// A language's strings are a module loaded on demand; under the whole suite running in parallel its
// first load can take longer than the default one-second wait.
const LOADED = { timeout: 5000 }

function renderMenu() {
  return render(
    <I18nProvider>
      <LanguageMenu />
    </I18nProvider>,
  )
}

describe('LanguageMenu', () => {
  it('shows the current locale as a short code and lists every language by its endonym', () => {
    renderMenu()
    const toggle = screen.getByRole('button', { name: /choose language/i })
    expect(toggle).toHaveTextContent('EN')

    fireEvent.click(toggle)
    const items = screen.getAllByRole('menuitemradio')
    expect(items.map((item) => item.textContent?.replace('✓', '').trim())).toEqual(LOCALES.map((l) => l.label))
    // Endonyms are never translated — and the current one is the checked one.
    expect(screen.getByRole('menuitemradio', { name: /English/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('menuitemradio', { name: /日本語/ })).toHaveAttribute('aria-checked', 'false')
  })

  // Paul, 2026-10-01: "when i am on French lang and then switch to German lang (or any two non EN
  // langs) it first rebuilds the UI in EN and THEN switches to the other lang." The choice is kept
  // at once; what is on screen changes in one step, once the new language's strings are here.
  it('keeps the choice at once, then switches code, labels and <html lang> together', async () => {
    renderMenu()
    fireEvent.click(screen.getByRole('button', { name: /choose language/i }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /简体中文/ }))

    expect(window.localStorage.getItem('KivaLensLocale')).toBe('zh-Hans')
    expect(await screen.findByRole('button', { name: '选择语言' }, LOADED)).toHaveTextContent('ZH')
    expect(document.documentElement.lang).toBe('zh-Hans')
  })

  it('moves between two other languages without passing through English', async () => {
    renderMenu()
    fireEvent.click(screen.getByRole('button', { name: /choose language/i }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Français/ }))
    const toggle = await screen.findByRole('button', { name: 'Choisir la langue' }, LOADED)
    // Every label and code the toggle takes from here on.
    const seen: string[] = []
    const note = () => seen.push(`${toggle.getAttribute('aria-label')} ${toggle.textContent?.trim()}`)
    const watch = new MutationObserver(note)
    watch.observe(toggle, { attributes: true, childList: true, subtree: true, characterData: true })
    fireEvent.click(toggle)
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Deutsch/ }))
    await screen.findByRole('button', { name: 'Sprache auswählen' }, LOADED)
    watch.disconnect()
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.filter((s) => s.startsWith('Choose language'))).toEqual([])
    expect(seen.filter((s) => /^Choisir la langue DE|^Sprache auswählen FR/.test(s))).toEqual([])
  })

  it('a language that finishes loading after a newer choice does not take over', async () => {
    renderMenu()
    fireEvent.click(screen.getByRole('button', { name: /choose language/i }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Français/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Choisir la langue' }, LOADED))
    // Italian is asked for, then French again before Italian has arrived.
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Italiano/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Choisir la langue' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Français/ }))
    await import('../i18n/locales/it')
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.getByRole('button', { name: 'Choisir la langue' })).toHaveTextContent('FR')
    expect(window.localStorage.getItem('KivaLensLocale')).toBe('fr')
  })

  it('switches back to a language already loaded at once', async () => {
    renderMenu()
    fireEvent.click(screen.getByRole('button', { name: /choose language/i }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Français/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Choisir la langue' }, LOADED))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Deutsch/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sprache auswählen' }, LOADED))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Français/ }))
    // No wait: French has been here once in this page.
    expect(screen.getByRole('button', { name: 'Choisir la langue' })).toHaveTextContent('FR')
    expect(document.documentElement.lang).toBe('fr')
  })

  it('opening the menu focuses the current language', () => {
    renderMenu()
    fireEvent.click(screen.getByRole('button', { name: /choose language/i }))
    expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: /English/ }))
  })

  it('ends with a divider and then Suggest Language, for every lender', () => {
    renderMenu()
    fireEvent.click(screen.getByRole('button', { name: /choose language/i }))
    const menu = screen.getByRole('menu')
    const suggest = screen.getByRole('menuitem', { name: 'Suggest Language' })
    expect(menu.lastElementChild).toBe(suggest)
    expect(suggest.previousElementSibling).toHaveAttribute('role', 'separator')
    // The languages are one labelled radio group, and Suggest Language is not in it.
    const group = screen.getByRole('group', { name: 'Languages' })
    expect(suggest.previousElementSibling!.previousElementSibling).toBe(group)
    expect(within(group).getAllByRole('menuitemradio')).toHaveLength(LOCALES.length)
    expect(group).not.toContainElement(suggest)
  })

  it('moves through the menu with the arrow keys, Suggest Language last', () => {
    renderMenu()
    fireEvent.click(screen.getByRole('button', { name: /choose language/i }))
    const menu = screen.getByRole('menu')
    const items = screen.getAllByRole('menuitemradio')
    const suggest = screen.getByRole('menuitem', { name: 'Suggest Language' })
    items[0].focus()
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1])
    fireEvent.keyDown(menu, { key: 'End' })
    expect(document.activeElement).toBe(suggest)
    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items[items.length - 1])
    fireEvent.keyDown(menu, { key: 'End' })
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[0])
  })
})
