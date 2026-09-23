import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Container, Col, Row, Button, ButtonGroup, ListGroup, Card, Modal, Alert, Form } from '../ui'
import { useCriteriaStore, useLoanStore } from '../stores'
import { showAlert, showConfirm, showPrompt } from '../lib/dialog'
import { getKivaLoans } from '../api/kiva'
import type { Criteria } from '../types'
import type { SavedSearch } from '../stores/criteriaStore'
import { useI18n } from '../i18n'
import { summarizeCriteria, type Translate } from '../lib/summarizeCriteria'
import { pluralCategory } from '../lib/pluralCategory'
import { criteriaToSearch } from '../../server/criteriaUrl.mjs'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateCriteria(obj: unknown, t: Translate): string | null {
  if (!obj || typeof obj !== 'object') return t('invalid_json_not_object')
  const o = obj as Record<string, unknown>
  // Single named search
  if (o.name && typeof o.name === 'string' && (o.loan || o.partner || o.portfolio)) return null
  // Single search without name
  if (o.loan || o.partner || o.portfolio) return null
  // Array of named searches
  if (Array.isArray(obj)) {
    if (obj.length === 0) return t('empty_array')
    for (let i = 0; i < obj.length; i++) {
      const v = obj[i] as Record<string, unknown> | null
      if (!v || typeof v !== 'object') return t('item_index_not_object', { index: i })
      if (!v.loan && !v.partner && !v.portfolio) return t('item_index_missing_loan_partner', { index: i })
    }
    return null
  }
  // Named collection {name: {loan:{}, ...}}
  const keys = Object.keys(o)
  if (keys.length === 0) return t('no_saved_searches_found_json')
  for (const key of keys) {
    const v = o[key]
    if (!v || typeof v !== 'object') return t('invalid_search_name_not_object', { name: key })
    const vr = v as Record<string, unknown>
    if (!vr.loan && !vr.partner && !vr.portfolio) return t('invalid_search_name_missing_loan', { name: key })
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

/**
 * The named searches in an imported document, whichever of the three shapes it
 * has: a list of named searches, one search, or an object keyed by name. A file,
 * a pasted document and a shared link all arrive here, so they cannot drift.
 */
function collectSearches(
  obj: unknown,
  fallbackName: string,
): Record<string, SavedSearch> {
  const out: Record<string, SavedSearch> = {}
  if (Array.isArray(obj)) {
    obj.forEach((item: Record<string, unknown>, i) => {
      const name = String(item?.name ?? (i === 0 ? fallbackName : `${fallbackName} ${i + 1}`))
      out[name] = stripName(item) as unknown as SavedSearch
    })
    return out
  }
  if (isSingleSearch(obj)) {
    const o = obj as Record<string, unknown>
    out[String(o.name ?? fallbackName)] = stripName(o) as unknown as SavedSearch
    return out
  }
  for (const [name, value] of Object.entries((obj ?? {}) as Record<string, unknown>)) {
    out[name] = value as unknown as SavedSearch
  }
  return out
}


// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SavedSearches() {
  const { t, sector, number, locale } = useI18n()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const getSavedSearchNames = useCriteriaStore((s) => s.getSavedSearchNames)
  const getSavedSearch = useCriteriaStore((s) => s.getSavedSearch)
  const renameSearch = useCriteriaStore((s) => s.renameSearch)
  const deleteSearch = useCriteriaStore((s) => s.deleteSearch)
  const loadSearch = useCriteriaStore((s) => s.loadSearch)
  const importSearches = useCriteriaStore((s) => s.importSearches)
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
  const summary = useMemo(() => summarizeCriteria(selectedCrit, t, sector), [selectedCrit, t, sector])
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

  // A shared link (?import=) carries other lenders' searches. It asks first,
  // names what it would add, and is taken out of the address either way, so a
  // reload cannot ask twice. Sharing has produced these links for years with
  // nothing on this side to read them.
  const importFromUrlHandled = useRef(false)
  useEffect(() => {
    if (importFromUrlHandled.current) return
    const raw = searchParams.get('import')
    if (raw === null) return
    importFromUrlHandled.current = true

    // Taken out of the address now, not after the dialog: the lender may have
    // moved on by the time they answer, and clearing it then would write this
    // page's query over that one.
    const rest = new URLSearchParams(searchParams)
    rest.delete('import')
    setSearchParams(rest, { replace: true })

    let incoming: Record<string, SavedSearch> = {}
    try {
      const obj = JSON.parse(raw) as unknown
      if (validateCriteria(obj, t)) throw new Error('shape')
      incoming = collectSearches(obj, t('shared_search'))
    } catch {
      void showAlert(t('shared_link_not_readable'))
      return
    }

    const names = Object.keys(incoming)
    if (names.length === 0) {
      void showAlert(t('shared_link_not_readable'))
      return
    }
    const clashes = names.filter((name) => savedSearches[name])
    void (async () => {
      const one = pluralCategory(locale, names.length) === 'one'
      const key = clashes.length
        ? (one ? 'add_shared_searches_replacing_one' : 'add_shared_searches_replacing')
        : (one ? 'add_shared_searches_one' : 'add_shared_searches')
      const ok = await showConfirm(
        t(key, {
          count: number(names.length),
          names: (clashes.length ? clashes : names).join(', '),
        }),
        { title: t('shared_searches'), confirmLabel: t('add_them'), cancelLabel: t('cancel') },
      )
      if (ok) {
        const added = importSearches(incoming)
        refreshList()
        if (added.length) setSelected(added[0])
      }
    })()
  }, [searchParams, setSearchParams, savedSearches, importSearches, refreshList, t, locale, number])

  const handleSelect = useCallback((name: string) => {
    setSelected(name)
    setRenaming(false)
  }, [])

  const handleShowLoans = useCallback(
    (name: string) => {
      loadSearch(name)
      navigate('/search')
    },
    [loadSearch, navigate],
  )

  const handleDelete = useCallback(
    async (name: string) => {
      const ok = await showConfirm(t('delete_saved_search_name', { name: t(name) }), {
        title: t('delete_saved_search'),
        confirmLabel: t('delete'),
        danger: true,
      })
      if (ok) {
        deleteSearch(name)
        if (selected === name) setSelected(null)
        refreshList()
      }
    },
    [deleteSearch, selected, refreshList, t],
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
    renameSearch(oldName, newName)
    const newChecked = { ...checked }
    if (newChecked[oldName]) {
      newChecked[newName] = true
      delete newChecked[oldName]
    }
    setChecked(newChecked)
    setSelected(newName)
    setRenaming(false)
    refreshList()
  }, [selected, renameTo, renameSearch, checked, refreshList])

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
      void showAlert(t('no_searches_checked'))
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
  }, [checkedNames, getSavedSearch, t])

  const handleShareSelected = useCallback(async () => {
    if (checkedNames.length === 0) {
      void showAlert(t('no_searches_checked'))
      return
    }
    const arr = checkedNames.map((name) => {
      const crit = getSavedSearch(name) as (Criteria & { name?: string }) | undefined
      if (crit) {
        return { ...crit, name }
      }
      return { name, loan: {}, partner: {}, portfolio: {} }
    })
    // One search shares as the search itself — a link that opens Search already
    // filtered, with nothing to accept. Several can only be a bundle to add.
    const shareUrl =
      arr.length === 1
        ? `${window.location.origin}/search${criteriaToSearch(arr[0] as Criteria)}`
        : `${window.location.origin}/saved?import=${encodeURIComponent(JSON.stringify(arr))}`
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(shareUrl)
      void showAlert(t('share_link_copied_clipboard_send'), {
        title: t('share'),
      })
    } else {
      void showPrompt(t('copy_share_link'), { title: t('share'), defaultValue: shareUrl, multiline: true })
    }
  }, [checkedNames, getSavedSearch, t])

  const handleCopyJSON = useCallback(() => {
    if (!selected) return
    const crit = getSavedSearch(selected) as (Criteria & { name?: string }) | undefined
    if (!crit) return
    const data = JSON.stringify({ ...crit, name: selected }, null, 2)
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(data)
      void showAlert(t('copied_clipboard'))
    } else {
      void showPrompt(t('copy_json_2'), { title: t('copy_json'), defaultValue: data, multiline: true })
    }
  }, [selected, getSavedSearch, t])

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const obj = JSON.parse(ev.target?.result as string) as unknown
          const err = validateCriteria(obj, t)
          if (err) { void showAlert(err); return }
          importSearches(collectSearches(obj, file.name.replace('.json', '')))
          refreshList()
           void showAlert(t('import_successful'))
        } catch (ex) {
          void showAlert(t('invalid_json_file_message', { message: ex instanceof Error ? ex.message : String(ex) }))
        }
      }
      reader.readAsText(file)
      e.target.value = ''
    },
    [importSearches, refreshList, t],
  )

  const handleImportJSONChange = useCallback((text: string) => {
    let valid = false
    let error: string | null = null
    let autoName = ''
    try {
      const obj = JSON.parse(text) as unknown
      const err = validateCriteria(obj, t)
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
      if (text.trim().length > 0) error = t('invalid_json_message', { message: ex instanceof Error ? ex.message : String(ex) })
    }
    setImportJSON(text)
    setImportValid(valid)
    setImportError(error)
    if (autoName) setImportName(autoName)
  }, [t])

  const handleDoImportJSON = useCallback(() => {
    try {
      const obj = JSON.parse(importJSON) as unknown
      if (isSingleSearch(obj) && !importName.trim()) {
        void showAlert(t('please_enter_name_search'))
        return
      }
      importSearches(collectSearches(obj, importName.trim() || 'Imported'))
      refreshList()
      setShowImportModal(false)
    } catch (ex) {
      void showAlert(t('error_message', { message: ex instanceof Error ? ex.message : String(ex) }))
    }
  }, [importJSON, importName, importSearches, refreshList, t])

  // Parse import for preview
  let parsedImport: unknown = null
  try { parsedImport = importJSON ? JSON.parse(importJSON) as unknown : null } catch { /* ignore */ }
  const isSingle = parsedImport != null && isSingleSearch(parsedImport)

  return (
    // The app's container gives the page its side padding and bounds its rows,
    // as on Search and Partners.
    <Container fluid>
      <Row>
        <Col md={4}>
          <h4 style={{ marginTop: 5, marginBottom: 8 }}>{t('saved_searches')} ({searches.length})</h4>
          <div style={{ marginBottom: 6 }}>
            <ButtonGroup size="sm">
              <Button onClick={handleSelectAll}>{t('select_all')}</Button>
              <Button onClick={handleSelectNone}>{t('select_none')}</Button>
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
                     {t(name)}
                  </span>
                </ListGroup.Item>
              ))}
            </ListGroup>
            {searches.length === 0 ? (
              <p style={{ color: 'var(--kl-text-muted)', padding: 12 }}>{t('no_saved_searches_yet')}</p>
            ) : null}
          </div>
          <div style={{ paddingTop: 8, borderTop: '1px solid var(--kl-border)' }}>
            <ButtonGroup size="sm" className="mb-1">
              <Button onClick={handleExportAll}>{t('export_all')}</Button>
              <Button onClick={handleExportSelected} disabled={checkedNames.length === 0}>
                {t('export_checked_count', { count: checkedNames.length })}
              </Button>
              <Button onClick={handleShareSelected} disabled={checkedNames.length === 0}>
                {t('share_checked')}
              </Button>
            </ButtonGroup>
            <div>
              <ButtonGroup size="sm">
                <Button style={{ position: 'relative', overflow: 'hidden' }}>
                   {t('import_file_ellipsis')}
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportFile}
                    style={{ position: 'absolute', top: 0, right: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                  />
                </Button>
                <Button onClick={() => setShowImportModal(true)}>
                   {t('import_json_ellipsis')}
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
                    <Button size="sm" variant="primary" onClick={handleDoRename} className="ms-2">{t('save')}</Button>
                    <Button size="sm" onClick={() => setRenaming(false)} className="ms-1">{t('cancel')}</Button>
                  </span>
                ) : (
                   t(selected)
                )}
              </h3>

              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--kl-green-text)' }}>
                  {t('count_matching_loans', { count: number(matchingCount) })}
                </span>
              </div>

              <ButtonGroup className="mb-3">
                <Button variant="primary" onClick={() => handleShowLoans(selected)}>{t('show_loans')}</Button>
                {!renaming ? <Button onClick={handleStartRename}>{t('rename')}</Button> : null}
                <Button onClick={handleCopyJSON}>{t('copy_json')}</Button>
                <Button variant="danger" onClick={() => handleDelete(selected)}>{t('delete')}</Button>
              </ButtonGroup>

              {summary.length > 0 ? (
                <Card>
                  <Card.Header>{t('criteria_summary')}</Card.Header>
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
                    <p style={{ color: 'var(--kl-text-muted)', marginBottom: 0 }}>{t('no_specific_criteria_set_matches')}</p>
                  </Card.Body>
                </Card>
              )}
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--kl-text-muted)' }}>
              <h3>{t('select_saved_search')}</h3>
              <p>{t('browse_rename_share_export_import')}</p>
            </div>
          )}
        </Col>
      </Row>

      {/* Import JSON Modal */}
      <Modal show={showImportModal} onHide={() => setShowImportModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{t('import_saved_search_json')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>{t('paste_saved_search_json_below')}</p>
          {isSingle ? (
            <div className="mb-2">
              <Form.Label>{t('name_search')}</Form.Label>
              <Form.Control
                type="text"
                placeholder={t('enter_name_ellipsis')}
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
              />
            </div>
          ) : null}
          <Form.Control
            as="textarea"
            rows={10}
            placeholder={t('paste_json_here_ellipsis')}
            value={importJSON}
            onChange={(e) => handleImportJSONChange(e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
          {importValid ? (
            <Alert variant="success" className="mt-2 mb-0">
               {t('valid_criteria_detected')}
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
             {t('import')}
          </Button>
          <Button onClick={() => setShowImportModal(false)}>{t('cancel')}</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  )
}

export default SavedSearches
