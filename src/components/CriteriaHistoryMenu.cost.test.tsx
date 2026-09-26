// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../i18n'
import * as describe_ from '../lib/describeCriteria'
import CriteriaHistoryMenu from './CriteriaHistoryMenu'
import { useCriteriaStore } from '../stores'
import { resetCriteriaHistoryForTests, startCriteriaHistory } from '../stores/criteriaHistoryStore'
import { freshCriteria } from '../lib/freshCriteria'
import type { Criteria } from '../types'

vi.mock('../lib/describeCriteria', async (original) => {
  const real = await original<typeof import('../lib/describeCriteria')>()
  return { ...real, describeCriteria: vi.fn(real.describeCriteria) }
})

afterEach(cleanup)

describe('the History menu while it is closed', () => {
  it('costs a Name search nothing: no line is described until the menu opens', () => {
    resetCriteriaHistoryForTests()
    useCriteriaStore.getState().startFresh()
    const stop = startCriteriaHistory()
    render(
      <I18nProvider>
        <MemoryRouter>
          <CriteriaHistoryMenu />
        </MemoryRouter>
      </I18nProvider>,
    )
    const described = vi.mocked(describe_.describeCriteria)
    described.mockClear()
    let name = ''
    for (const letter of 'jennifer') {
      name += letter
      act(() => useCriteriaStore.getState().setCriteria({ ...freshCriteria(), loan: { name, use: '' } } as Criteria))
    }
    expect(described).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    expect(described).toHaveBeenCalled()
    stop()
  })
})
