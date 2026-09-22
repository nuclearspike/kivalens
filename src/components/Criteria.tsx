import { useState, useCallback } from 'react'
import { Button, Dropdown } from '../ui'
import { useCriteriaStore } from '../stores'
import { showPrompt, showConfirm } from '../lib/dialog'
import { getKivaLoans } from '../api/kiva'
import { CriteriaTabs } from './CriteriaTabs'
import { useI18n } from '../i18n'

// ---------------------------------------------------------------------------
// Criteria sidebar panel — the search switcher above CriteriaTabs
// ---------------------------------------------------------------------------

export function Criteria() {
  return (
    <div>
      <SearchSwitcher />
      <CriteriaTabs />
    </div>
  )
}

/**
 * Reset and the saved-search dropdown: the controls for which search is running.
 * They sit at the top of the criteria column, and with the criteria hidden they sit
 * at the top of the results instead (ResultsHeader), so a lender can flip between
 * saved searches without the facets. Rendered in one place at a time, never twice.
 */
export function SearchSwitcher() {
  const { t } = useI18n()
  const startFresh = useCriteriaStore((s) => s.startFresh)
  const loadSearch = useCriteriaStore((s) => s.loadSearch)
  const saveSearch = useCriteriaStore((s) => s.saveSearch)
  const deleteSearch = useCriteriaStore((s) => s.deleteSearch)
  const getSavedSearchNames = useCriteriaStore((s) => s.getSavedSearchNames)
  const lastSwitch = useCriteriaStore((s) => s.lastSwitch)

  const [searchNames, setSearchNames] = useState<string[]>(() => getSavedSearchNames())
  const [searchCounts, setSearchCounts] = useState<Record<string, number>>({})

  const refreshNames = useCallback(() => {
    const names = getSavedSearchNames()
    setSearchNames(names)
    const kl = getKivaLoans()
    if (kl?.isReady()) {
      const savedSearches = useCriteriaStore.getState().savedSearches
      const counts: Record<string, number> = {}
      for (const name of names) {
        const crit = savedSearches[name]
        if (crit) {
          try { counts[name] = kl.filter(crit, false).length } catch { counts[name] = 0 }
        }
      }
      setSearchCounts(counts)
    }
  }, [getSavedSearchNames])

  const handleClear = useCallback(() => {
    startFresh()
    refreshNames()
  }, [startFresh, refreshNames])

  const handleLoad = useCallback(
    (name: string) => {
      loadSearch(name)
      refreshNames()
    },
    [loadSearch, refreshNames],
  )

  const handleSaveAs = useCallback(async () => {
    const name = await showPrompt(t('enter_name_saved_search_criteria'), {
      title: t('save_search'),
    })
    if (name?.trim()) {
      saveSearch(name.trim())
      refreshNames()
    }
  }, [saveSearch, refreshNames, t])

  const handleDelete = useCallback(
    async (name: string) => {
      const ok = await showConfirm(t('delete_saved_search_name', { name: t(name) }), {
        title: t('delete_saved_search'),
        confirmLabel: t('delete'),
        danger: true,
      })
      if (ok) {
        deleteSearch(name)
        refreshNames()
      }
    },
    [deleteSearch, refreshNames, t],
  )

  return (
    <div className="kl-search-switcher">
        <Button size="sm" onClick={handleClear} style={{ whiteSpace: 'nowrap' }} data-aikl="reset">
          {t('reset')}
        </Button>

        <Dropdown onToggle={(isOpen) => { if (isOpen) refreshNames() }}>
          <Dropdown.Toggle size="sm" id="saved-search-dropdown" style={{ flex: 1 }} data-aikl="saved-searches">
            {lastSwitch ? `‘${t(lastSwitch)}’` : t('saved_searches')}
          </Dropdown.Toggle>
          <Dropdown.Menu style={{ maxHeight: 400, overflowY: 'auto', fontSize: 12 }}>
            {searchNames.map((name) => (
              <Dropdown.Item
                key={name}
                active={lastSwitch === name}
                onClick={() => handleLoad(name)}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                {searchCounts[name] != null ? (
                  <span className="saved-search-count">{searchCounts[name]}</span>
                ) : null}
                <span>{t(name)}</span>
              </Dropdown.Item>
            ))}
            {searchNames.length > 0 ? <Dropdown.Divider /> : null}
            {lastSwitch ? (
              <>
                <Dropdown.Item onClick={() => saveSearch(lastSwitch)}>{t('re_save_name', { name: t(lastSwitch) })}</Dropdown.Item>
                <Dropdown.Item onClick={() => handleDelete(lastSwitch)}>{t('delete_name', { name: t(lastSwitch) })}</Dropdown.Item>
              </>
            ) : null}
            <Dropdown.Item href="#/saved">{t('manage_saved_searches')}</Dropdown.Item>
            <Dropdown.Divider />
            <Dropdown.Item onClick={handleSaveAs}>{t('save_current_criteria_ellipsis')}</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
    </div>
  )
}

export default Criteria
