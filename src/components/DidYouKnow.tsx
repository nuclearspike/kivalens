import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '../i18n'

// Rendered via t(TIPS_HELP[index]); the _HELP suffix makes the catalog-coverage
// test enforce a translation for every tip (see src/i18n/extraCatalog.ts).
const TIPS_HELP = [
  'Use Portfolio Balancing to help balance your risk by diversifying across partners or to find countries and sectors you don\'t have yet.',
  'Did you know that KivaLens works on smart-phones and tablets, too?',
  'Click the "Saved Searches" button to see some samples of the types of queries you can do.',
  'When typing into one of the drop-downs, as soon as it highlights the one you want, you can press Tab or Enter. ESC closes the dropdown.',
  'You can hide loans you\'ve already loaned to by adding your Lender ID in the Options tab, then checking the "Exclude My Loans" option on the "Your Portfolio" tab.',
  'Use the "Saved Search" button when you have your search exactly like you want it, give it a name and be able to return to it whenever you want.',
  'Have you told your Kiva Lending Teams about your favorite KivaLens features yet?',
  'What else do you wish KivaLens could do? Check out the About page to contact me!',
  'You can click anywhere in one of the drop-down boxes to bring up the selection (you don\'t need to click the little arrow).',
  'Kiva\'s site does not allow you to search for multiple "Tags" (where the loan must be tagged with both) but that\'s a great way to narrow your search!',
  'To fill up your basket quickly with matching loans, use the "Bulk Add" button above the list of loans.',
  'KivaLens integrates the A+ Team\'s MFI research data for Secular, Social, and Religion ratings on the Partner tab.',
  'Are you getting too many results from a single partner? Use the "Limit to top X loans per" feature under the Loan criteria tab.',
  'The Options tab allows you to configure a Default Lending Amount, saving you time when adding loans to your basket.',
  'You can hover over labels with a dotted underline in the Criteria tabs to see helpful explanations.',
  'Use the "$/Hour" sort option to find trending loans that are being funded the quickest.',
  'Want to see graphs showing the distribution of loans across criteria? Make sure "Show distribution graphs" is enabled on the Options tab.',
  'You can use "All", "Any", or "None" operators on multi-select dropdowns like Themes and Tags to really fine-tune your search.',
  'If you only want to lend to Direct (non-MFI) loans, or vice-versa, there\'s a filter for that on the Partner criteria tab.'
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
