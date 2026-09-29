import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../ui'
import { useI18n } from '../i18n'
import { getKivaLoans } from '../api/kiva'
import { useCriteriaStore, useLoanStore, useUtilsStore } from '../stores'
import { DEFAULT_SAVED_SEARCH_NAMES, countSavedSearch, inSavedSearchMode } from '../stores/criteriaStore'
import { useCriteriaHistory } from '../stores/criteriaHistoryStore'
import type { Criteria, KivaLoan } from '../types'
import { clearLinkArrival, sameSearch, useLinkArrival } from '../lib/arrival'
import { currentVisit } from '../lib/visits'
import { greeting, searchStages, type StageId } from '../lib/searchStages'
import { criteriaDetails, criteriaSummary, describeCriteria, labelOf, valueOf, type DescribeDeps } from '../lib/describeCriteria'
import { removalSuggestions, type RemovalSuggestion } from '../lib/removalSuggestions'
import { buildBasketMix, concentrationWarnings, sanitizeLimits } from '../lib/basketMix'
import { lsj } from '../lib/localStorage'
import { pluralCategory } from '../lib/pluralCategory'
import { noteEvent } from '../lib/rum/usageEvents'
import { showPrompt } from '../lib/dialog'
import { showLenderIDModal } from '../lib/showLenderIdModal'
import { WELCOME_PROMPT } from '../lib/askKivaLensWelcome'
import { BasketSpreadLine } from './BasketMix'
import KivaImage from './KivaImage'

/**
 * The Search page's right-hand panel when no loan is open: it meets the lender
 * where they are rather than welcoming everyone as a newcomer (Paul, 2026-09-27).
 * Which cards show, and in what order, is src/lib/searchStages.ts; this draws them.
 *
 * Everything that decides a card is already in the browser when the page opens,
 * so the cards do not come and go as data arrives. Numbers that need the loan set
 * (how many loans a search finds, what is new) are counted once the page is idle
 * and fill in where a placeholder already stands.
 */

/** Built-in searches that need no lender ID: a newcomer's starting points. */
const STARTING_POINTS = ['expiring_soon', 'only_one_more_lender_needed', 'popular', 'pays_back_fast_ex_short', 'large_groups_evenly_men_women', 'young_parent']
/** Built-in searches read from the lender's own portfolio. */
const PORTFOLIO_POINTS = ['countries_i_dont_have', 'balance_partner_risk']
/** Saved searches listed before "All saved searches". */
const SAVED_SHOWN = 6
const DAY_MS = 86_400_000

interface HomeCounts {
  /** Loans each named search finds now. */
  /** Undefined while a search waits for part of the lender's portfolio (countSavedSearch). */
  searches: Record<string, number | undefined>
  /** Loans posted since the last visit: all of them, those this search finds, and per saved search. */
  newTotal: number
  newMatch: number
  newBySearch: Record<string, number>
  /** For a handful of results: the filters whose removal would find more. */
  widen: RemovalSuggestion[]
}

const postedAt = (loan: KivaLoan): number => {
  const d = (loan as { kl_posted_date?: Date }).kl_posted_date
  if (d instanceof Date) return d.getTime()
  const parsed = Date.parse(String((loan as { posted_date?: string }).posted_date ?? ''))
  return Number.isNaN(parsed) ? 0 : parsed
}

function idle(fn: () => void): () => void {
  if (typeof requestIdleCallback === 'function') {
    const h = requestIdleCallback(fn, { timeout: 1500 })
    return () => cancelIdleCallback(h)
  }
  const h = setTimeout(fn, 50)
  return () => clearTimeout(h)
}

function Card({ title, tone, children }: { title: ReactNode; tone?: 'attention'; children: ReactNode }) {
  const id = useId()
  return (
    <section className={`kl-home-card${tone ? ` kl-home-card-${tone}` : ''}`} aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      {children}
    </section>
  )
}

export default function SearchHome() {
  const i18n = useI18n()
  const { t, tx, number, currency, relativeTime, locale, data } = i18n
  const navigate = useNavigate()
  const basket = useLoanStore((s) => s.basket)
  const pendingCheckout = useLoanStore((s) => s.pendingCheckout)
  const allLoans = useLoanStore((s) => s.loans)
  const downloading = useLoanStore((s) => s.downloading)
  const filteredLoans = useLoanStore((s) => s.filteredLoans)
  const balancerDataVersion = useLoanStore((s) => s.balancerDataVersion)
  const lastKnown = useCriteriaStore((s) => s.lastKnown)
  const savedSearches = useCriteriaStore((s) => s.savedSearches)
  const lenderId = useUtilsStore((s) => s.lenderId)
  const lenderObj = useUtilsStore((s) => s.lenderObj)
  const aiServerEnabled = useUtilsStore((s) => s.aiServerEnabled)
  const aiWidgetDisabled = useUtilsStore((s) => s.aiWidgetDisabled)
  const history = useCriteriaHistory((s) => s.history)
  const link = useLinkArrival()
  const visit = useMemo(() => currentVisit(), [])
  const [now] = useState(() => Date.now())

  const loansReady = !downloading && allLoans.length > 0
  const deps: DescribeDeps = useMemo(
    () => ({ t, data, partnerName: (id) => getKivaLoans()?.getPartner(Number(id))?.name }),
    [t, data],
  )
  const describe = (c: Criteria) => describeCriteria(c, deps)
  const lines = describe(lastKnown)
  const ownSaved = Object.keys(savedSearches ?? {}).filter((n) => !DEFAULT_SAVED_SEARCH_NAMES.has(n))
  const top = history.entries[0]
  const fromEarlierVisit = !!top && top.at < visit.start && sameSearch(top.criteria, lastKnown)
  const onLinkedSearch = !!link && sameSearch(lastKnown, link.arrived)

  const stages = searchStages({
    now,
    onLinkedSearch,
    pendingCheckout,
    basketCount: basket.length,
    loansReady,
    resultCount: filteredLoans.length,
    searchIsDefault: lines.length === 0,
    searchUnchangedThisVisit: fromEarlierVisit,
    searchFromEarlierVisit: fromEarlierVisit,
    previousVisitEnd: visit.previousEnd,
    ownSavedSearchCount: ownSaved.length,
    historyBeforeVisit: history.entries.some((e) => e.at < visit.start),
    lenderId,
  })
  const has = (s: StageId) => stages.includes(s)
  const stagesKey = stages.join(',')

  // Counted after paint, when the page is idle, and again when what they count changes.
  const [counts, setCounts] = useState<HomeCounts | null>(null)
  useEffect(() => {
    if (!loansReady) return
    return idle(() => {
      try {
        countNow()
      } catch (e) {
        // Placeholders never hang on "Counting…": the numbers are left out, and the
        // error still reaches the collector as an uncaught one (src/lib/rum/errors.ts).
        setCounts({ searches: {}, newTotal: 0, newMatch: 0, newBySearch: {}, widen: [] })
        setTimeout(() => {
          throw e
        })
      }
    })
    function countNow() {
      const kl = getKivaLoans()
      if (!kl?.isReady()) return
      const names = new Set<string>(ownSaved)
      if (has('first_visit')) STARTING_POINTS.forEach((n) => names.add(n))
      if (has('lender')) PORTFOLIO_POINTS.forEach((n) => names.add(n))
      const searches: Record<string, number | undefined> = {}
      for (const name of names) {
        const crit = savedSearches[name]
        if (crit) searches[name] = countSavedSearch(kl, crit as Criteria)
      }
      const prev = visit.previousEnd
      const newBySearch: Record<string, number> = {}
      let newTotal = 0
      let newMatch = 0
      if (prev !== null && has('new_since')) {
        newTotal = allLoans.filter((l) => postedAt(l as KivaLoan) > prev).length
        newMatch = filteredLoans.filter((l) => postedAt(l as KivaLoan) > prev).length
        for (const name of ownSaved) {
          const crit = savedSearches[name]
          if (!crit) continue
          try {
            const found = kl.filter(inSavedSearchMode(crit as Criteria), false) as KivaLoan[]
            newBySearch[name] = found.filter((l) => postedAt(l) > prev).length
          } catch {
            newBySearch[name] = 0
          }
        }
      }
      const widen = has('few_results')
        ? removalSuggestions(lastKnown, lenderId, kl).filter((s) => s.count > filteredLoans.length).slice(0, 3)
        : []
      setCounts({ searches, newTotal, newMatch, newBySearch, widen })
    }
    // `has` reads `stages`, which stagesKey stands for.
  }, [loansReady, allLoans, filteredLoans, savedSearches, lastKnown, lenderId, visit.previousEnd, stagesKey, balancerDataVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  const one = (v: number) => pluralCategory(locale, v) === 'one'
  const loansText = (count: number | undefined) =>
    count === undefined ? t('home_loans', { count: '…' }) : t(one(count) ? 'home_loans_one' : 'home_loans', { count: number(count) })
  const act = (stage: StageId) => noteEvent(`home:${stage}`)
  const openSearch = (stage: StageId, name: string) => {
    act(stage)
    useCriteriaStore.getState().loadSearch(name)
  }
  // A built-in starting point that finds nothing right now stays where it is (rows
  // never jump as counts arrive), its Open disabled with the reason on hover. A
  // lender's own search opens whatever it finds: they may want to change it.
  const searchRow = (stage: StageId, name: string, count: number | undefined, opts: { extra?: ReactNode; builtIn?: boolean } = {}) => {
    const empty = !!opts.builtIn && count === 0
    return (
      <li key={name} className="kl-home-row">
        <span className="kl-home-row-name" title={t(name)}>
          {t(name)}
          {opts.extra}
        </span>
        <span className="kl-home-row-count">{loansText(count)}</span>
        <Button
          size="sm"
          variant="outline-secondary"
          disabled={empty}
          title={empty ? t('home_finds_none_now') : undefined}
          onClick={() => openSearch(stage, name)}
          aria-label={t('home_open_name', { name: t(name) })}
        >
          {t('home_open')}
        </Button>
      </li>
    )
  }
  const newTag = (name: string) => {
    const k = counts?.newBySearch[name] ?? 0
    return k > 0 ? <span className="kl-home-new"> {t(one(k) ? 'home_new_in_search_one' : 'home_new_in_search', { count: number(k) })}</span> : null
  }

  // --- the basket, read without changing it (the basket page tidies it) ---
  const kl = getKivaLoans()
  const entries = useMemo(() => useLoanStore.getState().getBasket(), [basket, allLoans]) // eslint-disable-line react-hooks/exhaustive-deps
  const basketTotal = basket.reduce((sum, b) => sum + (b.amount || 0), 0)
  const fundraising = (l: KivaLoan | undefined) => !!l && l.status === 'fundraising'
  const finished = entries.filter((e) => !fundraising(e.loan)).length
  const missing = loansReady && kl ? basket.filter((b) => !kl.getById(b.loan_id)).length : 0
  const expiring = entries.filter((e) => {
    const d = e.loan && (e.loan as { kl_planned_expiration_date?: Date }).kl_planned_expiration_date
    return fundraising(e.loan) && d instanceof Date && d.getTime() - now < DAY_MS
  }).length
  const overAsk = entries.filter((e) => fundraising(e.loan) && typeof e.loan?.kl_still_needed === 'number' && e.amount > e.loan.kl_still_needed).length
  const mix = useMemo(() => buildBasketMix(entries, (id) => kl?.getPartner(id)), [entries]) // eslint-disable-line react-hooks/exhaustive-deps
  const warnings = useMemo(() => concentrationWarnings(mix, null, sanitizeLimits(lsj.get('Options'))), [mix])

  const greet = greeting(stages)
  const heading =
    greet === 'back_from_kiva'
      ? t('home_back_from_kiva')
      : greet === 'welcome'
        ? t('welcome_kivalens')
        : lenderObj?.name
          ? t('home_welcome_back_name', { name: lenderObj.name })
          : t('home_welcome_back')

  const cards: ReactNode[] = []
  for (const stage of stages) {
    if (stage === 'link' && link) {
      // The search the link replaced comes back as it runs, like any other picked from a list.
      const previous = inSavedSearchMode(link.previous)
      const previousLines = describe(previous)
      cards.push(
        <Card key={stage} title={t('home_link_title')}>
          <p className="kl-home-summary" title={criteriaDetails(lines, t)}>{criteriaSummary(lines, t)}</p>
          <p>{t(one(filteredLoans.length) ? 'home_link_finds_one' : 'home_link_finds', { count: number(filteredLoans.length) })}</p>
          <div className="kl-home-actions">
            <LinkSaveButton onSaved={() => act('link')} />
            {previousLines.length > 0 ? (
              <Button
                size="sm"
                variant="outline-secondary"
                title={criteriaDetails(previousLines, t)}
                onClick={() => {
                  act('link')
                  useCriteriaStore.getState().setCriteria(previous)
                  clearLinkArrival()
                }}
              >
                {t('home_link_back')}
              </Button>
            ) : null}
          </div>
        </Card>,
      )
    } else if (stage === 'back_from_kiva' && pendingCheckout) {
      const sent = pendingCheckout.ids.length
      const amount = basket.filter((b) => pendingCheckout.ids.includes(b.loan_id)).reduce((s, b) => s + (b.amount || 0), 0)
      cards.push(
        <Card key={stage} title={t('home_checkout_title')} tone="attention">
          <p>
            {t(one(sent) ? 'home_checkout_body_one' : 'home_checkout_body', { count: number(sent), amount: currency(amount), when: relativeTime(pendingCheckout.at, now) })}
          </p>
          <p className="kl-home-note">{t(lenderId ? 'home_checkout_verify_lender' : 'home_checkout_verify_ask')}</p>
          <div className="kl-home-actions">
            <Button size="sm" variant="primary" onClick={() => { act(stage); navigate('/basket') }}>
              {t('home_checkout_action')}
            </Button>
          </div>
        </Card>,
      )
    } else if (stage === 'basket') {
      const problems: string[] = []
      if (finished > 0) problems.push(t(one(finished) ? 'home_basket_finished_one' : 'home_basket_finished', { count: number(finished) }))
      if (missing > 0) problems.push(t(one(missing) ? 'home_basket_missing_one' : 'home_basket_missing', { count: number(missing) }))
      if (expiring > 0) problems.push(t(one(expiring) ? 'home_basket_expiring_one' : 'home_basket_expiring', { count: number(expiring) }))
      if (overAsk > 0) problems.push(t(one(overAsk) ? 'home_basket_over_one' : 'home_basket_over', { count: number(overAsk) }))
      const status = !loansReady ? t('home_basket_checking') : problems.length ? problems.join(' ') : t('home_basket_all_good')
      cards.push(
        <Card key={stage} title={t('home_basket_title')} tone={problems.length ? 'attention' : undefined}>
          <p>
            <strong>{t(one(basket.length) ? 'home_basket_summary_one' : 'home_basket_summary', { count: number(basket.length), amount: currency(basketTotal) })}</strong>
          </p>
          {entries.length > 0 ? (
            <ul className="kl-home-faces" aria-label={t('home_basket_borrowers')}>
              {entries.slice(0, 6).map((e) =>
                e.loan ? (
                  <li key={e.id}>
                    <Link to={`/basket/${e.id}`} title={e.loan.name} onClick={() => act(stage)}>
                      <KivaImage type="square" loan={e.loan} image_width={80} width={40} height={40} />
                    </Link>
                  </li>
                ) : null,
              )}
            </ul>
          ) : null}
          {/* Always present while the basket has loans, so a check finishing moves nothing (Paul's rule 43). */}
          <p className={`kl-home-status${problems.length ? ' kl-home-status-attention' : ''}`} role="status">{status}</p>
          {loansReady && entries.length > 1 ? <BasketSpreadLine mix={mix} warnings={warnings} onSeeWhy={() => { act(stage); navigate('/basket') }} /> : null}
          <div className="kl-home-actions">
            <Button size="sm" variant="primary" onClick={() => { act(stage); navigate('/basket') }}>
              {t('home_basket_action')}
            </Button>
          </div>
        </Card>,
      )
    } else if (stage === 'few_results') {
      const widen = counts?.widen
      cards.push(
        <Card key={stage} title={t(one(filteredLoans.length) ? 'home_few_title_one' : 'home_few_title', { count: number(filteredLoans.length) })}>
          {widen === undefined ? (
            <p className="kl-home-note">{t('home_counting')}</p>
          ) : widen.length === 0 ? (
            <p className="kl-home-note">{t('home_few_nothing')}</p>
          ) : (
            <>
              <p>{t('home_few_body')}</p>
              <ul className="kl-home-list">
                {widen.map((w) => (
                  <li key={w.id} className="kl-home-row">
                    <span className="kl-home-row-name">
                      <strong>{labelOf(w, t)}:</strong> {valueOf(w, deps) ?? t('on')}
                    </span>
                    <span className="kl-home-row-count">{loansText(w.count)}</span>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={() => {
                        act(stage)
                        useCriteriaStore.getState().setCriteria(w.without(lastKnown))
                      }}
                      aria-label={t('remove_label_value_count_loans', { label: labelOf(w, t), value: valueOf(w, deps) ?? t('on'), count: w.count })}
                    >
                      {t('home_few_remove')}
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>,
      )
    } else if (stage === 'new_since' && visit.previousEnd !== null) {
      const sortedNewest = (lastKnown.loan as Record<string, unknown> | undefined)?.sort === 'newest'
      cards.push(
        <Card key={stage} title={t('home_new_title')}>
          <p>{t('home_new_when', { when: relativeTime(visit.previousEnd, now) })}</p>
          <p>
            {counts === null
              ? t('home_counting')
              : `${t(one(counts.newTotal) ? 'home_new_total_one' : 'home_new_total', { count: number(counts.newTotal) })} ${
                  counts.newTotal === 0 ? '' : counts.newMatch === 0 ? t('home_new_none_match') : t(one(counts.newMatch) ? 'home_new_match_one' : 'home_new_match', { count: number(counts.newMatch) })
                }`}
          </p>
          {counts && counts.newMatch > 0 && !sortedNewest ? (
            <div className="kl-home-actions">
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => {
                  act(stage)
                  useCriteriaStore.getState().setCriteria({ ...lastKnown, loan: { ...(lastKnown.loan ?? {}), sort: 'newest' } } as Criteria)
                }}
              >
                {t('home_new_newest_first')}
              </Button>
            </div>
          ) : null}
        </Card>,
      )
    } else if (stage === 'continuing') {
      cards.push(
        <Card key={stage} title={t('home_continue_title')}>
          <p className="kl-home-summary" title={criteriaDetails(lines, t)}>{criteriaSummary(lines, t)}</p>
          <p>{t(one(filteredLoans.length) ? 'home_continue_finds_one' : 'home_continue_finds', { count: number(filteredLoans.length) })}</p>
          <p className="kl-home-note">{t('home_continue_history')}</p>
          <div className="kl-home-actions">
            <Button size="sm" variant="outline-secondary" onClick={() => { act(stage); useCriteriaStore.getState().startFresh() }}>
              {t('home_start_fresh')}
            </Button>
          </div>
        </Card>,
      )
    } else if (stage === 'saved') {
      cards.push(
        <Card key={stage} title={t('home_saved_title')}>
          <ul className="kl-home-list">{ownSaved.slice(0, SAVED_SHOWN).map((name) => searchRow(stage, name, counts?.searches[name], { extra: newTag(name) }))}</ul>
          {ownSaved.length > SAVED_SHOWN ? (
            <p className="kl-home-note">
              <Link to="/saved" onClick={() => act(stage)}>{t('home_saved_all', { count: number(ownSaved.length) })}</Link>
            </p>
          ) : null}
        </Card>,
      )
    } else if (stage === 'lender') {
      const since = lenderObj?.member_since ? new Date(lenderObj.member_since).getUTCFullYear() : null
      const loanCount = lenderObj?.loan_count
      cards.push(
        <Card key={stage} title={t('home_lender_title')}>
          <p>
            {loanCount === undefined
              ? t('home_lender_reading')
              : since
                ? t(one(loanCount) ? 'home_lender_stats_one' : 'home_lender_stats', { count: number(loanCount), year: String(since) })
                : t(one(loanCount) ? 'home_lender_stats_noyear_one' : 'home_lender_stats_noyear', { count: number(loanCount) })}
          </p>
          <p className="kl-home-note">{t('home_lender_suggest')}</p>
          <ul className="kl-home-list">
            {PORTFOLIO_POINTS.filter((name) => savedSearches[name]).map((name) => searchRow(stage, name, counts?.searches[name], { builtIn: true }))}
          </ul>
          <p className="kl-home-note">
            <Link to="/stats" onClick={() => act(stage)}>{t('home_lender_stats_link')}</Link>
          </p>
        </Card>,
      )
    } else if (stage === 'lender_pitch') {
      cards.push(
        <Card key={stage} title={t('home_pitch_title')}>
          <p>{t('home_pitch_body')}</p>
          <p className="kl-home-note">{t('lender_id_hint')}</p>
          <div className="kl-home-actions">
            <Button size="sm" variant="primary" onClick={() => { act(stage); showLenderIDModal() }}>
              {t('set_lender_id_2')}
            </Button>
          </div>
        </Card>,
      )
    } else if (stage === 'first_visit') {
      const points = STARTING_POINTS.filter((name) => savedSearches[name])
      if (points.length) {
        cards.push(
          <Card key={`${stage}-points`} title={t('home_start_title')}>
            <p className="kl-home-note">{t('home_start_body')}</p>
            <ul className="kl-home-list">{points.map((name) => searchRow(stage, name, counts?.searches[name], { builtIn: true }))}</ul>
          </Card>,
        )
      }
      cards.push(
        <Card key={stage} title={t('quick_start')}>
          <ol className="kl-home-steps">
            <li>{t('use_criteria_left_filter_loans')}</li>
            <li>{t('click_loan_review_details_repayment')}</li>
            <li>{t('click_lend_loans_like')}</li>
            <li>{t('go_basket_tab_transfer_loans')}</li>
          </ol>
          {!lenderId ? (
            <p className="kl-home-note">
              {tx('set_lender_id_purpose', {
                link: (
                  <button type="button" className="kl-link-button" onClick={() => { act(stage); showLenderIDModal() }}>
                    {t('set_lender_id_2')}
                  </button>
                ),
              })}
            </p>
          ) : null}
          <div className="kl-home-actions">
            {aiServerEnabled && !aiWidgetDisabled ? (
              <Button size="sm" variant="primary" onClick={() => { act(stage); useUtilsStore.getState().openAskKl(t(WELCOME_PROMPT)) }}>
                {t('need_help_getting_started_chat')}
              </Button>
            ) : null}
            <Link className="kl-home-link" to="/about">{t('learn_more')}</Link>
          </div>
        </Card>,
      )
    }
  }

  return (
    <div className="kl-home" data-aikl="welcome">
      <h2 className="kl-home-heading">{heading}</h2>
      {cards}
    </div>
  )
}

/** Save the linked search under a name; says so in place afterwards. */
function LinkSaveButton({ onSaved }: { onSaved: () => void }) {
  const { t } = useI18n()
  const [saved, setSaved] = useState<string | null>(null)
  if (saved) return <span className="kl-home-done" role="status">{t('home_link_saved', { name: saved })}</span>
  return (
    <Button
      size="sm"
      variant="primary"
      onClick={async () => {
        const name = await showPrompt(t('enter_name_saved_search_criteria'), { title: t('save_search') })
        if (!name?.trim()) return
        useCriteriaStore.getState().saveSearch(name.trim())
        setSaved(name.trim())
        onSaved()
      }}
    >
      {t('home_link_save')}
    </Button>
  )
}
