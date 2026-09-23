// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import KLNav from './KLNav'
import { useUtilsStore } from '../stores'
import en from '../i18n/locales/en'

afterEach(cleanup)

describe('KLNav: the Wall is never hidden', () => {
  // The Wall works without a lender ID (it shows loans raising money now) and pitches
  // the ID there, so hiding its link hid a working page.
  for (const lenderId of ['', 'examplelender']) {
    it(`shows the Wall link ${lenderId ? 'with' : 'without'} a lender ID`, () => {
      useUtilsStore.setState({ lenderId })
      render(<MemoryRouter><KLNav /></MemoryRouter>)
      expect(screen.getByRole('link', { name: en.wall })).toHaveAttribute('href', '/wall')
    })
  }
})
