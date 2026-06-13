import { useState, useCallback, useEffect, useMemo } from 'react'
import { Col, Row, Button, ButtonGroup, ListGroup, Card, Modal, Alert, Form } from '../ui'
import numeral from 'numeral'
import { useCriteriaStore, useLoanStore } from '../stores'
import { showAlert, showConfirm, showPrompt } from '../lib/dialog'
import { getKivaLoans } from '../api/kiva'
import type { Criteria } from '../types'
import type { SavedSearch } from '../stores/criteriaStore'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateCriteria(obj: unknown): string | null {
  if (!obj || typeof obj !== 'object') return 'Invalid JSON: not an object'
  const o = obj as Record<string, unknown>
  // Single named search
  if (o.name && typeof o.name === 'string' && (o.loan || o.partner || o.portfolio)) return null
  // Single search without name
  if (o.loan || o.partner || o.portfolio) return null
  // Array of named searches
  if (Array.isArray(obj)) {
    if (obj.length === 0) return 'Empty array'
    for (let i = 0; i < obj.length; i++) {
      const v = obj[i] as Record<string, unknown> | null
      if (!v || typeof v !== 'object') return `Item ${i}: not an object`
      if (!v.loan && !v.partner && !v.portfolio) return `Item ${i}: missing loan/partner/portfolio`
    }
    return null
  }
  // Named collection {name: {loan:{}, ...}}
  const keys = Object.keys(o)
  if (keys.length === 0) return 'No saved searches found in JSON'
  for (const key of keys) {
    const v = o[key]
    if (!v || typeof v !== 'object') return `Invalid search "${key}": not an object`
    const vr = v as Record<string, unknown>
    if (!vr.loan && !vr.partner && !vr.portfolio) return `Invalid search "${key}": missing loan/partner/portfolio`
  }
  return null
}

function isSingleSearch(obj: unknown): boolean {
  if (!obj || Array.isArray(obj)) return false
  const o = obj as Record<string, unknown>
  return !!(o.loan || o.partner || o.portfolio)
}

function stripName(obj: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...obj }
  delete copy.name
  return copy
}

interface SummaryItem {
  label: string
  value: string
}

function summarizeCriteria(crit: SavedSearch | undefined): SummaryItem[] {
  if (!crit) return []
  const items: SummaryItem[] = []
  const loan = crit.loan as Record<string, unknown> | undefined
  if (loan) {
    if (loan.sector) items.push({ label: 'Sectors', value: String(loan.sector) })
    if (loan.country_code) items.push({ label: 'Countries', value: String(loan.country_code) })
    if (loan.activity) items.push({ label: 'Activities', value: String(loan.activity) })
    if (loan.tags) items.push({ label: 'Tags', value: String(loan.tags) })
    if (loan.themes) items.push({ label: 'Themes', value: String(loan.themes) })
    if (loan.repaid_in_min || loan.repaid_in_max)
      items.push({ label: 'Repaid In', value: `${loan.repaid_in_min ?? 'min'} - ${loan.repaid_in_max ?? 'max'} months` })
    if (loan.still_needed_min || loan.still_needed_max)
      items.push({ label: 'Still Needed', value: `$${loan.still_needed_min ?? 0} - $${loan.still_needed_max ?? 'max'}` })
    if (loan.sort) items.push({ label: 'Sort', value: String(loan.sort) })
    if (loan.name) items.push({ label: 'Name search', value: String(loan.name) })
    if (loan.use) items.push({ label: 'Use/Description', value: String(loan.use) })
  }
  const partner = crit.partner as Record<string, unknown> | undefined
  if (partner) {
    if (partner.region) items.push({ label: 'Regions', value: String(partner.region) })
    if (partner.religion) items.push({ label: 'Religion', value: String(partner.religion) })
  }
  if (crit.portfolio) {
    if (crit.portfolio.exclude_portfolio_loans === 'true')
      items.push({ label: 'Portfolio', value: 'Excluding my loans' })
    const balancers = ['pb_sector', 'pb_country', 'pb_activity', 'pb_partner'] as const
    for (const b of balancers) {
      const bal = crit.portfolio[b]
      if (bal?.enabled) items.push({ label: 'Balancing', value: b.replace('pb_', '') })
    }
  }
  return items
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SavedSearches() {
  const getSavedSearchNames = useCriteriaStore((s) => s.getSavedSearchNames)
  const getSavedSearch = useCriteriaStore((s) => s.getSavedSearch)
  const saveSearch = useCriteriaStore((s) => s.saveSearch)
  const deleteSearch = useCriteriaStore((s) => s.deleteSearch)
  const loadSearch = useCriteriaStore((s) => s.loadSearch)
  const savedSearches = useCriteriaStore((s) => s.savedSearches)

  const [searches, setSearches] = useState<string[]>(() => getSavedSearchNames())
  const [selected, setSelected] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [renameTo, setRenameTo] = useState('')
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false)
  const [importJSON, setImportJSON] = useState('')
  const [importName, setImportName] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [importValid, setImportValid] = useState(false)

  const refreshList = useCallback(() => {
    setSearches(getSavedSearchNames())
  }, [getSavedSearchNames])

  // Refresh when savedSearches changes in the store
  useEffect(() => {
    refreshList()
  }, [savedSearches, refreshList])

  const loanCount = useLoanStore((s) => s.loanCount)

  const selectedCrit = selected ? getSavedSearch(selected) : undefined
  const summary = useMemo(() => summarizeCriteria(selectedCrit), [selectedCrit])
  const checkedNames = useMemo(() => searches.filter((n) => checked[n]), [searches, checked])

  const matchingCount = useMemo(() => {
    if (!selected) return 0
    const kl = getKivaLoans()
    if (!kl?.isReady()) return 0
    const crit = getSavedSearch(selected)
    if (!crit) return 0
    try { return kl.filter(crit, false).length } catch { return 0 }
  }, [selected, getSavedSearch, loanCount])

  const searchCounts = useMemo(() => {
    const kl = getKivaLoans()
    if (!kl?.isReady()) return {} as Record<string, number>
    const counts: Record<string, number> = {}
    for (const name of searches) {
      const crit = savedSearches[name]
      if (crit) {
        try { counts[name] = kl.filter(crit, false).length } catch { counts[name] = 0 }
      }
    }
    return counts
  }, [searches, savedSearches, loanCount])

  const handleSelect = useCallback((name: string) => {
    setSelected(name)
    setRenaming(false)
  }, [])

  const handleShowLoans = useCallback(
    (name: string) => {
      loadSearch(name)
      window.location.hash = '#/search'
    },
    [loadSearch],
  )

  const handleDelete = useCallback(
    async (name: string) => {
      const ok = await showConfirm(`Delete saved search "${name}"?`, {
        title: 'Delete Saved Search',
        confirmLabel: 'Delete',
        danger: true,
      })
      if (ok) {
        deleteSearch(name)
        if (selected === name) setSelected(null)
        refreshList()
      }
    },
    [deleteSearch, selected, refreshList],
  )

  const handleStartRename = useCallback(() => {
    if (selected) {
      setRenaming(true)
      setRenameTo(selected)
    }
  }, [selected])

  const handleDoRename = useCallback(() => {
    const oldName = selected
    const newName = renameTo.trim()
    if (!newName || !oldName || newName === oldName) {
      setRenaming(false)
      return
    }
    const crit = getSavedSearch(oldName)
    if (crit) {
      deleteSearch(oldName)
      // Store the criteria under the new name by setting it, then saving
      // We need to use the store directly
      useCriteriaStore.getState().savedSearches[newName] = crit
      saveSearch(newName)
    }
    const newChecked = { ...checked }
    if (newChecked[oldName]) {
      newChecked[newName] = true
      delete newChecked[oldName]
    }
    setChecked(newChecked)
    setSelected(newName)
    setRenaming(false)
    refreshList()
  }, [selected, renameTo, getSavedSearch, deleteSearch, saveSearch, checked, refreshList])

  const handleToggleCheck = useCallback((name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setChecked((prev) => ({ ...prev, [name]: !prev[name] }))
  }, [])

  const handleSelectAll = useCallback(() => {
    const all: Record<string, boolean> = {}
    searches.forEach((n) => { all[n] = true })
    setChecked(all)
  }, [searches])

  const handleSelectNone = useCallback(() => {
    setChecked({})
  }, [])

  const handleExportAll = useCallback(() => {
    const data: Record<string, SavedSearch | undefined> = {}
    searches.forEach((name) => { data[name] = getSavedSearch(name) })
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'kivalens-saved-searches.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [searches, getSavedSearch])

  const handleExportSelected = useCallback(() => {
    if (checkedNames.length === 0) {
      void showAlert('No searches checked.')
      return
    }
    const data: Record<string, SavedSearch | undefined> = {}
    checkedNames.forEach((name) => { data[name] = getSavedSearch(name) })
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'kivalens-saved-searches.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [checkedNames, getSavedSearch])

  const handleShareSelected = useCallback(async () => {
    if (checkedNames.length === 0) {
      void showAlert('No searches checked.')
      return
    }
    const arr = checkedNames.map((name) => {
      const crit = getSavedSearch(name) as (Criteria & { name?: string }) | undefined
      if (crit) {
        return { ...crit, name }
      }
      return { name, loan: {}, partner: {}, portfolio: {} }
    })
    const encoded = encodeURIComponent(JSON.stringify(arr))
    const shareUrl = `${window.location.origin}/#/saved?importSS=${encoded}`
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(shareUrl)
      void showAlert('Share link copied to clipboard! Send this link to other KivaLens users.', {
        title: 'Share',
      })
    } else {
      void showPrompt('Copy this share link:', { title: 'Share', defaultValue: shareUrl, multiline: true })
    }
  }, [checkedNames, getSavedSearch])

  const handleCopyJSON = useCallback(() => {
    if (!selected) return
    const crit = getSavedSearch(selected) as (Criteria & { name?: string }) | undefined
    if (!crit) return
    const data = JSON.stringify({ ...crit, name: selected }, null, 2)
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(data)
      void showAlert('Copied to clipboard!')
    } else {
      void showPrompt('Copy this JSON:', { title: 'Copy JSON', defaultValue: data, multiline: true })
    }
  }, [selected, getSavedSearch])

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const obj = JSON.parse(ev.target?.result as string) as unknown
          const err = validateCriteria(obj)
          if (err) { void showAlert(err); return }
          if (Array.isArray(obj)) {
            obj.forEach((item: Record<string, unknown>) => {
              const name = String(item.name ?? 'Imported')
              useCriteriaStore.getState().savedSearches[name] = stripName(item) as unknown as SavedSearch
            })
          } else if (isSingleSearch(obj)) {
            const o = obj as Record<string, unknown>
            const name = String(o.name ?? file.name.replace('.json', ''))
            useCriteriaStore.getState().savedSearches[name] = stripName(o) as unknown as SavedSearch
          } else {
            const o = obj as Record<string, unknown>
            Object.keys(o).forEach((name) => {
              useCriteriaStore.getState().savedSearches[name] = o[name] as unknown as SavedSearch
            })
          }
          refreshList()
          void showAlert('Import successful!')
        } catch (ex) {
          void showAlert('Invalid JSON file: ' + (ex instanceof Error ? ex.message : String(ex)))
        }
      }
      reader.readAsText(file)
      e.target.value = ''
    },
    [refreshList],
  )

  const handleImportJSONChange = useCallback((text: string) => {
    let valid = false
    let error: string | null = null
    let autoName = ''
    try {
      const obj = JSON.parse(text) as unknown
      const err = validateCriteria(obj)
      if (err) {
        error = err
      } else {
        valid = true
        if (isSingleSearch(obj)) {
          const o = obj as Record<string, unknown>
          if (o.name && typeof o.name === 'string') autoName = o.name
        }
      }
    } catch (ex) {
      if (text.trim().length > 0) error = 'Invalid JSON: ' + (ex instanceof Error ? ex.message : String(ex))
    }
    setImportJSON(text)
    setImportValid(valid)
    setImportError(error)
    if (autoName) setImportName(autoName)
  }, [])

  const handleDoImportJSON = useCallback(() => {
    try {
      const obj = JSON.parse(importJSON) as unknown
      if (Array.isArray(obj)) {
        obj.forEach((item: Record<string, unknown>) => {
          const name = String(item.name ?? 'Imported')
          useCriteriaStore.getState().savedSearches[name] = stripName(item) as unknown as SavedSearch
        })
      } else if (isSingleSearch(obj)) {
        const name = importName.trim()
        if (!name) { void showAlert('Please enter a name for this search.'); return }
        useCriteriaStore.getState().savedSearches[name] = stripName(obj as Record<string, unknown>) as unknown as SavedSearch
      } else {
        const o = obj as Record<string, unknown>
        Object.keys(o).forEach((name) => {
          useCriteriaStore.getState().savedSearches[name] = o[name] as unknown as SavedSearch
        })
      }
      refreshList()
      setShowImportModal(false)
    } catch (ex) {
      void showAlert('Error: ' + (ex instanceof Error ? ex.message : String(ex)))
    }
  }, [importJSON, importName, refreshList])

  // Parse import for preview
  let parsedImport: unknown = null
  try { parsedImport = importJSON ? JSON.parse(importJSON) as unknown : null } catch { /* ignore */ }
  const isSingle = parsedImport != null && isSingleSearch(parsedImport)

  return (
    <div>
      <Row>
        <Col md={4}>
          <h4 style={{ marginTop: 5, marginBottom: 8 }}>Saved Searches ({searches.length})</h4>
          <div style={{ marginBottom: 6 }}>
            <ButtonGroup size="sm">
              <Button onClick={handleSelectAll}>Select All</Button>
              <Button onClick={handleSelectNone}>Select None</Button>
            </ButtonGroup>
          </div>
          <div style={{ height: 'calc(100vh - 230px)', overflowY: 'auto' }}>
            <ListGroup>
              {searches.map((name) => (
                <ListGroup.Item
                  key={name}
                  active={selected === name}
                  action
                  onClick={() => handleSelect(name)}
                  style={{ padding: '4px 8px', fontSize: 13, display: 'flex', alignItems: 'center' }}
                >
                  <Form.Check
                    type="checkbox"
                    checked={!!checked[name]}
                    onChange={() => {/* handled by onClick */}}
                    onClick={(e) => handleToggleCheck(name, e)}
                    style={{ marginRight: 6 }}
                  />
                  {searchCounts[name] != null ? (
                    <span className="saved-search-count">{searchCounts[name]}</span>
                  ) : null}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {name}
                  </span>
                </ListGroup.Item>
              ))}
            </ListGroup>
            {searches.length === 0 ? (
              <p style={{ color: '#999', padding: 12 }}>No saved searches yet.</p>
            ) : null}
          </div>
          <div style={{ paddingTop: 8, borderTop: '1px solid #ddd' }}>
            <ButtonGroup size="sm" className="mb-1">
              <Button onClick={handleExportAll}>Export All</Button>
              <Button onClick={handleExportSelected} disabled={checkedNames.length === 0}>
                Export Checked ({checkedNames.length})
              </Button>
              <Button onClick={handleShareSelected} disabled={checkedNames.length === 0}>
                Share Checked
              </Button>
            </ButtonGroup>
            <div>
              <ButtonGroup size="sm">
                <Button style={{ position: 'relative', overflow: 'hidden' }}>
                  Import File...
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportFile}
                    style={{ position: 'absolute', top: 0, right: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                  />
                </Button>
                <Button onClick={() => setShowImportModal(true)}>
                  Import JSON...
                </Button>
              </ButtonGroup>
            </div>
          </div>
        </Col>

        <Col md={8}>
          {selected && selectedCrit ? (
            <div>
              <h3 style={{ marginTop: 5 }}>
                {renaming ? (
                  <span>
                    <Form.Control
                      type="text"
                      style={{ display: 'inline', width: '60%' }}
                      value={renameTo}
                      onChange={(e) => setRenameTo(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleDoRename() }}
                      autoFocus
                    />
                    <Button size="sm" variant="primary" onClick={handleDoRename} className="ms-2">Save</Button>
                    <Button size="sm" onClick={() => setRenaming(false)} className="ms-1">Cancel</Button>
                  </span>
                ) : (
                  selected
                )}
              </h3>

              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 18, fontWeight: 600, color: '#2C8C5E' }}>
                  {numeral(matchingCount).format('0,0')} matching loans
                </span>
              </div>

              <ButtonGroup className="mb-3">
                <Button variant="primary" onClick={() => handleShowLoans(selected)}>Show Loans</Button>
                {!renaming ? <Button onClick={handleStartRename}>Rename</Button> : null}
                <Button onClick={handleCopyJSON}>Copy JSON</Button>
                <Button variant="danger" onClick={() => handleDelete(selected)}>Delete</Button>
              </ButtonGroup>

              {summary.length > 0 ? (
                <Card>
                  <Card.Header>Criteria Summary</Card.Header>
                  <Card.Body>
                    <dl className="row mb-0">
                      {summary.map((item, i) => (
                        <span key={i}>
                          <dt className="col-sm-4">{item.label}</dt>
                          <dd className="col-sm-8">{item.value}</dd>
                        </span>
                      ))}
                    </dl>
                  </Card.Body>
                </Card>
              ) : (
                <Card>
                  <Card.Body>
                    <p style={{ color: '#999', marginBottom: 0 }}>No specific criteria set (matches all loans)</p>
                  </Card.Body>
                </Card>
              )}
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
              <h3>Select a saved search</h3>
              <p>Browse, rename, share, export, and import your saved searches.</p>
            </div>
          )}
        </Col>
      </Row>

      {/* Import JSON Modal */}
      <Modal show={showImportModal} onHide={() => setShowImportModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Import Saved Search from JSON</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Paste a saved search JSON below. Get this from &quot;Copy JSON&quot; on any saved search to share with teammates.</p>
          {isSingle ? (
            <div className="mb-2">
              <Form.Label>Name for this search:</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter a name..."
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
              />
            </div>
          ) : null}
          <Form.Control
            as="textarea"
            rows={10}
            placeholder="Paste JSON here..."
            value={importJSON}
            onChange={(e) => handleImportJSONChange(e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
          {importValid ? (
            <Alert variant="success" className="mt-2 mb-0">
              Valid criteria detected
            </Alert>
          ) : null}
          {importError ? (
            <Alert variant="danger" className="mt-2 mb-0">
              {importError}
            </Alert>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="primary"
            onClick={handleDoImportJSON}
            disabled={!importValid || (isSingle && !importName.trim())}
          >
            Import
          </Button>
          <Button onClick={() => setShowImportModal(false)}>Cancel</Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default SavedSearches
