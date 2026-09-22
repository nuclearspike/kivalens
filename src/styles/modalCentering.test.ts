import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Paul's rule 40: every modal sits in the vertical center of the viewport. Centering
// lives on the shared .modal-dialog class, so every modal gets it — the UI kit's
// Modal and the hand-rolled ones (Basket's transfer, Bulk Add) alike — and no call
// site can forget to ask for it. jsdom does no layout, so this guards the rule the
// modals depend on; the geometry itself is checked in a real browser.

const stylesDir = fileURLToPath(new URL('.', import.meta.url))
const read = (path: string) => readFileSync(join(stylesDir, path), 'utf8')
const rulesFor = (source: string, selector: string) =>
  [...source.matchAll(new RegExp(`(^|\\n)${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'g'))].map((m) => m[2]).join('\n')

function scssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? scssFiles(path) : name.endsWith('.scss') ? [path] : []
  })
}

describe('modals: always vertically centered', () => {
  const overlays = read('base/_overlays.scss')
  const dialog = rulesFor(overlays, '.modal-dialog')

  it('the shared dialog box is a viewport-tall flex column that centers its content', () => {
    expect(dialog).toMatch(/display:\s*flex;/)
    expect(dialog).toMatch(/align-items:\s*center;/)
    expect(dialog).toMatch(/min-height:\s*calc\(100% - \d+px\);/)
  })

  it('presses on the empty space around the content still reach the backdrop', () => {
    expect(dialog).toMatch(/pointer-events:\s*none;/)
    expect(rulesFor(overlays, '.modal-content')).toMatch(/pointer-events:\s*auto;/)
  })

  it('no stylesheet re-anchors a dialog to the top or brings back an opt-in centering class', () => {
    for (const file of scssFiles(stylesDir)) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).not.toMatch(/\.modal-dialog-centered/)
      for (const rule of [...source.matchAll(/\.modal-dialog[^{,]*\{([^}]*)\}/g)].map((m) => m[1])) {
        expect(rule, file).not.toMatch(/align-items:\s*(flex-start|start)|align-self:\s*(flex-start|start)/)
      }
    }
  })
})
