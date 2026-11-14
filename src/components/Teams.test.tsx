// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Teams from './Teams'
import { useUtilsStore } from '../stores'
import en from '../i18n/locales/en'
import { LenderTeams } from '../api/kivajs/LenderTeams'
import { req } from '../api/kivajs/req'
import { HttpStatusError } from '../api/kivajs/kivaBase'
import { escapesWithNoWindow, held, turn } from '../test/lateWork'

afterEach(() => {
  cleanup()
  useUtilsStore.setState({ lenderModalOpen: false })
  vi.restoreAllMocks()
  delete (globalThis as { reportError?: unknown }).reportError
})

const collect = () => {
  const reported: string[] = []
  ;(globalThis as { reportError?: (e: unknown) => void }).reportError = (e) => reported.push((e as Error).message)
  return reported
}

describe('Teams reports the failures it shows', () => {

  it('a team graph Kiva would not give, shown in the chart pane and sent to the error collector', async () => {
    const reported = collect()
    vi.spyOn(LenderTeams.prototype, 'start').mockResolvedValue([{ id: 7, name: 'Team Seven' }] as never)
    vi.spyOn(req.kiva.ajax, 'get').mockRejectedValue(new HttpStatusError(502))
    useUtilsStore.setState({ lenderId: 'somelender' })
    render(<Teams />)
    fireEvent.click(await screen.findByLabelText('Team Seven'))
    await waitFor(() => expect(reported).toEqual(['Reading a team graph from Kiva failed: HTTP 502']))
    expect(screen.getByText('HTTP 502')).toBeInTheDocument()
  })

  it('the lender’s teams Kiva would not give', async () => {
    const reported = collect()
    vi.spyOn(LenderTeams.prototype, 'start').mockRejectedValue(new HttpStatusError(503))
    useUtilsStore.setState({ lenderId: 'somelender' })
    render(<Teams />)
    await waitFor(() => expect(reported).toEqual(["Reading the lender's teams from Kiva failed: HTTP 503"]))
  })
})

describe('Teams without a lender ID', () => {
  it('pitches what the ID unlocks instead of showing an error', () => {
    useUtilsStore.setState({ lenderId: '' })
    render(<Teams />)
    expect(screen.getByRole('heading', { name: en.pitch_teams_title })).toBeInTheDocument()
    expect(screen.getByText(en.pitch_teams_body)).toBeInTheDocument()
    expect(document.querySelector('.alert-danger')).toBeNull()
  })

  it('its button opens the lender-ID dialog', () => {
    useUtilsStore.setState({ lenderId: '' })
    render(<Teams />)
    fireEvent.click(screen.getByRole('button', { name: en.set_lender_id_2 }))
    expect(useUtilsStore.getState().lenderModalOpen).toBe(true)
  })
})

type Team = { id: number; name: string }

describe('Teams answers that come back late', () => {
  it("a slow answer for the last lender's teams never replaces this lender's", async () => {
    const first = held<Team[]>()
    const second = held<Team[]>()
    vi.spyOn(LenderTeams.prototype, 'start')
      .mockReturnValueOnce(first.promise as never)
      .mockReturnValueOnce(second.promise as never)
    useUtilsStore.setState({ lenderId: 'firstlender' })
    render(<Teams />)
    act(() => useUtilsStore.setState({ lenderId: 'secondlender' }))
    await act(async () => {
      second.resolve([{ id: 2, name: 'Second Team' }])
      await turn()
    })
    await act(async () => {
      first.resolve([{ id: 1, name: 'First Team' }])
      await turn()
    })
    expect(screen.getByLabelText('Second Team')).toBeInTheDocument()
    expect(screen.queryByLabelText('First Team')).toBeNull()
  })

  // A late answer is neither shown nor taken for a failure: an update that throws there would be
  // reported as Kiva's.
  it("the lender's teams arriving after the page has gone change nothing, and nothing throws", async () => {
    const reported = collect()
    const teams = held<Team[]>()
    vi.spyOn(LenderTeams.prototype, 'start').mockReturnValue(teams.promise as never)
    useUtilsStore.setState({ lenderId: 'somelender' })
    render(<Teams />).unmount()
    expect(await escapesWithNoWindow(() => teams.resolve([{ id: 7, name: 'Team Seven' }]))).toEqual([])
    expect(reported).toEqual([])
  })

  it("the lender's teams failing after the page has gone change nothing, and nothing throws, and are still reported", async () => {
    const reported = collect()
    const teams = held<Team[]>()
    vi.spyOn(LenderTeams.prototype, 'start').mockReturnValue(teams.promise as never)
    useUtilsStore.setState({ lenderId: 'somelender' })
    render(<Teams />).unmount()
    expect(await escapesWithNoWindow(() => teams.reject(new HttpStatusError(503)))).toEqual([])
    expect(reported).toEqual(["Reading the lender's teams from Kiva failed: HTTP 503"])
  })

  it('a team graph failing after the page has gone changes nothing, and nothing throws, and is still reported', async () => {
    const reported = collect()
    const graph = held<unknown>()
    vi.spyOn(LenderTeams.prototype, 'start').mockResolvedValue([{ id: 7, name: 'Team Seven' }] as never)
    vi.spyOn(req.kiva.ajax, 'get').mockReturnValue(graph.promise as never)
    useUtilsStore.setState({ lenderId: 'somelender' })
    const { unmount } = render(<Teams />)
    fireEvent.click(await screen.findByLabelText('Team Seven'))
    unmount()
    expect(await escapesWithNoWindow(() => graph.reject(new HttpStatusError(502)))).toEqual([])
    expect(reported).toEqual(['Reading a team graph from Kiva failed: HTTP 502'])
  })

  it('a team graph arriving after the page has gone changes nothing, and nothing throws', async () => {
    const reported = collect()
    const graph = held<unknown>()
    vi.spyOn(LenderTeams.prototype, 'start').mockResolvedValue([{ id: 7, name: 'Team Seven' }] as never)
    vi.spyOn(req.kiva.ajax, 'get').mockReturnValue(graph.promise as never)
    useUtilsStore.setState({ lenderId: 'somelender' })
    const { unmount } = render(<Teams />)
    fireEvent.click(await screen.findByLabelText('Team Seven'))
    expect(req.kiva.ajax.get).toHaveBeenCalledTimes(1)
    unmount()
    expect(await escapesWithNoWindow(() => graph.resolve({ graphData: [['1700000000000', 3]] }))).toEqual([])
    expect(reported).toEqual([])
  })

  it("a graph's failure is shown only on its own graph, and another graph's answer does not clear it", async () => {
    collect()
    const membership = held<unknown>()
    const loanCount = held<unknown>()
    vi.spyOn(LenderTeams.prototype, 'start').mockResolvedValue([{ id: 7, name: 'Team Seven' }] as never)
    vi.spyOn(req.kiva.ajax, 'get')
      .mockReturnValueOnce(membership.promise as never)
      .mockReturnValueOnce(loanCount.promise as never)
    useUtilsStore.setState({ lenderId: 'somelender' })
    render(<Teams />)
    fireEvent.click(await screen.findByLabelText('Team Seven'))
    fireEvent.click(screen.getByLabelText(en.loan_count))
    expect(req.kiva.ajax.get).toHaveBeenCalledTimes(2)
    // Loan Count fails while it is on screen...
    await act(async () => {
      loanCount.reject(new HttpStatusError(502))
      await turn()
    })
    expect(screen.getByText('HTTP 502')).toBeInTheDocument()
    // ...and Membership's late answer, for a graph not on screen, leaves that failure showing.
    await act(async () => {
      membership.resolve({ graphData: [['1700000000000', 3]] })
      await turn()
    })
    expect(screen.getByText('HTTP 502')).toBeInTheDocument()
  })

  it("a failure of a graph no longer on screen is not shown on the one that is", async () => {
    collect()
    const membership = held<unknown>()
    const loanCount = held<unknown>()
    vi.spyOn(LenderTeams.prototype, 'start').mockResolvedValue([{ id: 7, name: 'Team Seven' }] as never)
    vi.spyOn(req.kiva.ajax, 'get')
      .mockReturnValueOnce(membership.promise as never)
      .mockReturnValueOnce(loanCount.promise as never)
    useUtilsStore.setState({ lenderId: 'somelender' })
    render(<Teams />)
    fireEvent.click(await screen.findByLabelText('Team Seven'))
    fireEvent.click(screen.getByLabelText(en.loan_count))
    await act(async () => {
      loanCount.resolve({ graphData: [['1700000000000', 3]] })
      await turn()
    })
    await act(async () => {
      membership.reject(new HttpStatusError(502))
      await turn()
    })
    expect(screen.queryByText('HTTP 502')).toBeNull()
  })

  it("a failure of a graph no longer on screen does not hide the failure of the one that is", async () => {
    collect()
    const membership = held<unknown>()
    const loanCount = held<unknown>()
    vi.spyOn(LenderTeams.prototype, 'start').mockResolvedValue([{ id: 7, name: 'Team Seven' }] as never)
    vi.spyOn(req.kiva.ajax, 'get')
      .mockReturnValueOnce(membership.promise as never)
      .mockReturnValueOnce(loanCount.promise as never)
    useUtilsStore.setState({ lenderId: 'somelender' })
    render(<Teams />)
    fireEvent.click(await screen.findByLabelText('Team Seven'))
    fireEvent.click(screen.getByLabelText(en.loan_count))
    await act(async () => {
      loanCount.reject(new Error('Count failed'))
      await turn()
    })
    await act(async () => {
      membership.reject(new Error('Membership failed'))
      await turn()
    })
    expect(screen.getByText('Count failed')).toBeInTheDocument()
    expect(screen.queryByText('Membership failed')).toBeNull()
  })
})
