import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '../i18n'

// Rendered via t(TIPS_HELP[index]); the _HELP suffix makes the catalog-coverage
// test (and scripts/check-i18n.mjs) enforce a translation for every tip.
// Each entry is a catalog key, not display text — see src/i18n/locales/en.ts.
const TIPS_HELP = [
  'use_portfolio_balancing_help_balance',
  'did_know_kivalens_works_smart_phones',
  'click_saved_searches_button_see',
  'when_typing_into_one_drop_downs',
  'hide_loans_youve_already_loaned',
  'use_saved_search_button_when',
  'have_told_kiva_lending_teams',
  'what_else_wish_kivalens_could',
  'click_anywhere_one_drop_down_boxes',
  'kivas_site_not_allow_search',
  'fill_up_basket_quickly_matching',
  'kivalens_integrates_teams_mfi_research',
  'getting_too_many_results_single',
  'hover_over_labels_dotted_underline',
  'use_dollar_hour_sort_option',
  'want_see_graphs_showing_distribution',
  'use_all_any_none_operators',
  'if_only_want_lend_direct'
]

/**
 * Cycles through KivaLens tips/trivia on a timer.
 */
export default function DidYouKnow() {
  const { t } = useI18n()
  const [index, setIndex] = useState(() => Math.floor(Math.random() * TIPS_HELP.length))

  const advance = useCallback(() => {
    setIndex((prev) => (prev + 1) % TIPS_HELP.length)
  }, [])

  useEffect(() => {
    const id = setInterval(advance, 15000)
    return () => clearInterval(id)
  }, [advance])

  return <p>{t(TIPS_HELP[index])}</p>
}
