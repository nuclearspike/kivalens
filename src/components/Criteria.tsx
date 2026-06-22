import { useState, useCallback } from 'react'
import { Button, Dropdown } from '../ui'
import { useCriteriaStore, useLoanStore } from '../stores'
import { showPrompt, showConfirm } from '../lib/dialog'
import { getKivaLoans } from '../api/kiva'
import { CriteriaTabs } from './CriteriaTabs'

// ---------------------------------------------------------------------------
// Criteria sidebar panel — wraps CriteriaTabs + saved-search dropdown
// ---------------------------------------------------------------------------

export function Criteria() {
  const startFresh = useCriteriaStore((s) => s.startFresh)
  const loadSearch = useCriteriaStore((s) => s.loadSearch)
  const saveSearch = useCriteriaStore((s) => s.saveSearch)
  const deleteSearch = useCriteriaStore((s) => s.deleteSearch)
  const getSavedSearchNames = useCriteriaStore((s) => s.getSavedSearchNames)
  const lastSwitch = useCriteriaStore((s) => s.lastSwitch)

  const [searchNames, setSearchNames] = useState<string[]>(() => getSavedSearchNames())
  const [searchCounts, setSearchCounts] = useState<Record<string, number>>({})
  const loanCount = useLoanStore((s) => s.loanCount)

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
  }, [getSavedSearchNames, loanCount])

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
    const name = await showPrompt('Enter name for saved search criteria:', {
      title: 'Save Search',
    })
    if (name?.trim()) {
      saveSearch(name.trim())
      refreshNames()
    }
  }, [saveSearch, refreshNames])

  const handleDelete = useCallback(
    async (name: string) => {
      const ok = await showConfirm(`Delete saved search "${name}"?`, {
        title: 'Delete Saved Search',
        confirmLabel: 'Delete',
        danger: true,
      })
      if (ok) {
        deleteSearch(name)
        refreshNames()
      }
    },
    [deleteSearch, refreshNames],
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, alignItems: 'center' }}>
        <Button size="sm" onClick={handleClear} style={{ whiteSpace: 'nowrap' }} data-aikl="reset">
          Reset
        </Button>

        <Dropdown onToggle={(isOpen) => { if (isOpen) refreshNames() }}>
          <Dropdown.Toggle size="sm" id="saved-search-dropdown" style={{ flex: 1 }} data-aikl="saved-searches">
            {lastSwitch ? `'${lastSwitch}'` : 'Saved Searches'}
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
                <span>{name}</span>
              </Dropdown.Item>
            ))}
            {searchNames.length > 0 ? <Dropdown.Divider /> : null}
            {lastSwitch ? (
              <>
                <Dropdown.Item onClick={() => saveSearch(lastSwitch)}>
                  Re-save &apos;{lastSwitch}&apos;
                </Dropdown.Item>
                <Dropdown.Item onClick={() => handleDelete(lastSwitch)}>
                  Delete &apos;{lastSwitch}&apos;
                </Dropdown.Item>
              </>
            ) : null}
            <Dropdown.Item href="#/saved">Manage Saved Searches</Dropdown.Item>
            <Dropdown.Divider />
            <Dropdown.Item onClick={handleSaveAs}>Save Current Criteria As...</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>

      <CriteriaTabs />
    </div>
  )
}

export default Criteria
