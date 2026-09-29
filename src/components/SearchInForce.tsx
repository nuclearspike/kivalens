import { useI18n } from '../i18n'

/**
 * Said beside a stored search that is already the one in force, wherever searches
 * are offered: the Search welcome panel, Saved Searches and History (isSearchInForce).
 * Choosing it would change nothing, so the lists say so rather than offer it (Paul,
 * 2026-09-29: "when i click the button it does NOTHING bc I'm already on that ... we
 * need either to hide it or to indicate that you're already doing it"). Text, not
 * colour alone, with the check the language menu uses for its current choice.
 */
export function SearchInForceTag({ className = 'kl-in-force-tag' }: { className?: string }) {
  const { t } = useI18n()
  return (
    <span className={className} title={t('search_in_force_title')}>
      <span aria-hidden="true">✓ </span>
      {t('search_in_force')}
    </span>
  )
}
