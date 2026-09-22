import { ButtonGroup, Button } from '../ui'
import { SearchSwitcher } from './Criteria'
import { useI18n } from '../i18n'

/**
 * The top of the results column: Show/Hide Criteria and Bulk Add, and — while the
 * criteria are hidden — the search switcher (Reset and saved searches), so flipping
 * between saved searches never needs the facets on screen.
 */
export default function ResultsHeader({
  showCriteria,
  onToggleCriteria,
  onBulkAdd,
}: {
  showCriteria: boolean
  onToggleCriteria: () => void
  onBulkAdd: () => void
}) {
  const { t } = useI18n()
  return (
    <>
      {!showCriteria && <SearchSwitcher />}
      <ButtonGroup className="top-only d-flex" style={{ marginBottom: 0 }}>
        <Button onClick={onToggleCriteria} className="w-50">
          {t(showCriteria ? 'hide_criteria' : 'show_criteria')}
        </Button>
        <Button onClick={onBulkAdd} className="w-50" data-aikl="bulk-add">
          {t('bulk_add')}
        </Button>
      </ButtonGroup>
    </>
  )
}
