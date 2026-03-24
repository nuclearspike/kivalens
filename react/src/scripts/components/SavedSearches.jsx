'use strict'

import React from 'react'
import Reflux from 'reflux'
import {Col, Row, ListGroupItem, Button, ButtonGroup, Panel, Input, Modal, Alert, Label, Checkbox} from 'react-bootstrap'
import a from '../actions'
import s from '../stores/'
import numeral from 'numeral'
import cx from 'classnames'
import extend from 'extend'

function validateCriteria(obj) {
    if (!obj || typeof obj !== 'object') return 'Invalid JSON: not an object'
    // Single named search: {name: "...", loan: {}, ...}
    if (obj.name && typeof obj.name === 'string' && (obj.loan || obj.partner || obj.portfolio)) return null
    // Single search without name: must have at least loan or partner or portfolio
    if (obj.loan || obj.partner || obj.portfolio) return null
    // Array of named searches
    if (Array.isArray(obj)) {
        if (obj.length === 0) return 'Empty array'
        for (var i = 0; i < obj.length; i++) {
            var v = obj[i]
            if (!v || typeof v !== 'object') return `Item ${i}: not an object`
            if (!v.loan && !v.partner && !v.portfolio) return `Item ${i}: missing loan/partner/portfolio`
        }
        return null
    }
    // Named collection {name: {loan:{}, ...}}
    var keys = Object.keys(obj)
    if (keys.length === 0) return 'No saved searches found in JSON'
    for (var i = 0; i < keys.length; i++) {
        var v = obj[keys[i]]
        if (!v || typeof v !== 'object') return `Invalid search "${keys[i]}": not an object`
        if (!v.loan && !v.partner && !v.portfolio) return `Invalid search "${keys[i]}": missing loan/partner/portfolio`
    }
    return null
}

function isSingleSearch(obj) {
    return !!(obj && !Array.isArray(obj) && (obj.loan || obj.partner || obj.portfolio))
}

function getImportName(obj) {
    if (obj && obj.name && typeof obj.name === 'string') return obj.name
    return ''
}

function stripName(obj) {
    var copy = extend(true, {}, obj)
    delete copy.name
    return copy
}

function summarizeCriteria(crit) {
    if (!crit) return []
    var items = []
    if (crit.loan) {
        var l = crit.loan
        if (l.sector) items.push({label: 'Sectors', value: l.sector})
        if (l.country_code) items.push({label: 'Countries', value: l.country_code})
        if (l.activity) items.push({label: 'Activities', value: l.activity})
        if (l.tags) items.push({label: 'Tags', value: l.tags})
        if (l.themes) items.push({label: 'Themes', value: l.themes})
        if (l.repaid_in_min || l.repaid_in_max) items.push({label: 'Repaid In', value: `${l.repaid_in_min || 'min'} - ${l.repaid_in_max || 'max'} months`})
        if (l.still_needed_min || l.still_needed_max) items.push({label: 'Still Needed', value: `$${l.still_needed_min || 0} - $${l.still_needed_max || 'max'}`})
        if (l.borrower_count_min || l.borrower_count_max) items.push({label: 'Borrowers', value: `${l.borrower_count_min || 'min'} - ${l.borrower_count_max || 'max'}`})
        if (l.percent_female_min || l.percent_female_max) items.push({label: '% Female', value: `${l.percent_female_min || 0}% - ${l.percent_female_max || 100}%`})
        if (l.sort) items.push({label: 'Sort', value: l.sort})
        if (l.name) items.push({label: 'Name search', value: l.name})
        if (l.use) items.push({label: 'Use/Description', value: l.use})
    }
    if (crit.partner) {
        var p = crit.partner
        if (p.region) items.push({label: 'Regions', value: p.region})
        if (p.religion) items.push({label: 'Religion', value: p.religion})
        if (p.partner_risk_rating_min || p.partner_risk_rating_max) items.push({label: 'Risk Rating', value: `${p.partner_risk_rating_min || 'min'} - ${p.partner_risk_rating_max || 'max'}`})
    }
    if (crit.portfolio) {
        var pf = crit.portfolio
        if (pf.exclude_portfolio_loans === 'true') items.push({label: 'Portfolio', value: 'Excluding my loans'})
        var balancers = ['pb_sector', 'pb_country', 'pb_activity', 'pb_partner']
        balancers.forEach(b => {
            if (pf[b] && pf[b].enabled) items.push({label: 'Balancing', value: b.replace('pb_', '')})
        })
    }
    return items
}

const SavedSearches = React.createClass({
    mixins: [Reflux.ListenerMixin],
    getInitialState() {
        return {
            selected: null,
            loanCount: null,
            counting: false,
            renaming: false,
            renameTo: '',
            checked: {},
            showImportModal: false,
            importJSON: '',
            importName: '',
            importError: null,
            importValid: false,
            showImportFromURL: false,
            importFromURLData: null,
            searches: s.criteria.syncGetAllNames()
        }
    },
    componentDidMount() {
        this.listenTo(a.criteria.savedSearchListChanged, this.refreshList)
        this.checkForURLImport()
    },
    checkForURLImport() {
        // Check for ?importSS= in the hash URL
        var hash = window.location.hash
        var match = hash.match(/[?&]importSS=([^&]+)/)
        if (match) {
            try {
                var decoded = decodeURIComponent(match[1])
                var data = JSON.parse(decoded)
                var err = validateCriteria(data)
                if (!err) {
                    this.setState({showImportFromURL: true, importFromURLData: data})
                }
            } catch(e) {
                console.log('Failed to parse importSS param:', e)
            }
            // Clean the URL
            window.location.hash = '#/saved'
        }
    },
    doImportFromURL() {
        var data = this.state.importFromURLData
        if (!data) return
        if (Array.isArray(data)) {
            data.forEach(item => {
                var name = item.name || 'Imported Search'
                var crit = stripName(item)
                s.criteria.all[name] = crit
            })
        } else if (isSingleSearch(data)) {
            var name = data.name || 'Imported Search'
            s.criteria.all[name] = stripName(data)
        } else {
            Object.keys(data).forEach(name => {
                s.criteria.all[name] = data[name]
            })
        }
        s.criteria.syncSavedAll()
        this.setState({showImportFromURL: false, importFromURLData: null})
    },
    skipImportFromURL() {
        this.setState({showImportFromURL: false, importFromURLData: null})
    },
    refreshList() {
        this.setState({searches: s.criteria.syncGetAllNames()})
    },
    selectSearch(name) {
        this.setState({selected: name, loanCount: null, counting: true, renaming: false})
        try {
            var crit = s.criteria.syncGetByName(name)
            var count = kivaloans.isReady() ? kivaloans.filter(crit, false).length : null
            this.setState({loanCount: count, counting: false})
        } catch(e) {
            this.setState({loanCount: 0, counting: false})
        }
    },
    showLoans(name) {
        a.criteria.switchToSaved(name)
        window.location.hash = '#/search'
    },
    deleteSearch(name) {
        if (confirm(`Delete saved search "${name}"?`)) {
            s.criteria.syncDelete(name)
            if (this.state.selected === name) {
                this.setState({selected: null, loanCount: null})
            }
        }
    },
    startRename() {
        this.setState({renaming: true, renameTo: this.state.selected})
    },
    doRename() {
        var oldName = this.state.selected
        var newName = this.state.renameTo.trim()
        if (!newName || newName === oldName) {
            this.setState({renaming: false})
            return
        }
        var crit = s.criteria.syncGetByName(oldName)
        s.criteria.all[newName] = crit
        delete s.criteria.all[oldName]
        s.criteria.syncSavedAll()
        // Update checked state
        var checked = this.state.checked
        if (checked[oldName]) {
            checked[newName] = true
            delete checked[oldName]
        }
        this.setState({selected: newName, renaming: false, checked: checked})
    },
    toggleCheck(name, e) {
        e.stopPropagation()
        var checked = extend({}, this.state.checked)
        checked[name] = !checked[name]
        this.setState({checked: checked})
    },
    selectAll() {
        var checked = {}
        this.state.searches.forEach(name => checked[name] = true)
        this.setState({checked: checked})
    },
    selectNone() {
        this.setState({checked: {}})
    },
    getCheckedNames() {
        return this.state.searches.filter(name => this.state.checked[name])
    },
    exportSelected() {
        var names = this.getCheckedNames()
        if (names.length === 0) { alert('No searches selected.'); return }
        var data = {}
        names.forEach(name => data[name] = s.criteria.syncGetByName(name))
        var blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'})
        var url = URL.createObjectURL(blob)
        var a = document.createElement('a')
        a.href = url
        a.download = 'kivalens-saved-searches.json'
        a.click()
        URL.revokeObjectURL(url)
    },
    shareSelected() {
        var names = this.getCheckedNames()
        if (names.length === 0) { alert('No searches selected.'); return }
        var arr = names.map(name => {
            var crit = extend(true, {}, s.criteria.syncGetByName(name))
            crit.name = name
            return crit
        })
        var encoded = encodeURIComponent(JSON.stringify(arr))
        var shareUrl = `https://www.kivalens.org/#/saved?importSS=${encoded}`
        if (navigator.clipboard) {
            navigator.clipboard.writeText(shareUrl)
            alert('Share link copied to clipboard! Send this link to other KivaLens users.')
        } else {
            prompt('Copy this share link:', shareUrl)
        }
    },
    exportAll() {
        var data = lsj.get('all_criteria')
        var blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'})
        var url = URL.createObjectURL(blob)
        var a = document.createElement('a')
        a.href = url
        a.download = 'kivalens-saved-searches.json'
        a.click()
        URL.revokeObjectURL(url)
    },
    copyJSON() {
        var crit = extend(true, {}, s.criteria.syncGetByName(this.state.selected))
        crit.name = this.state.selected
        var data = JSON.stringify(crit, null, 2)
        if (navigator.clipboard) {
            navigator.clipboard.writeText(data)
            alert('Copied to clipboard!')
        } else {
            prompt('Copy this JSON:', data)
        }
    },
    importFile(e) {
        var file = e.target.files[0]
        if (!file) return
        var reader = new FileReader()
        reader.onload = (ev) => {
            try {
                var obj = JSON.parse(ev.target.result)
                var err = validateCriteria(obj)
                if (err) { alert(err); return }
                if (Array.isArray(obj)) {
                    obj.forEach(item => {
                        var name = item.name || 'Imported'
                        s.criteria.all[name] = stripName(item)
                    })
                } else if (isSingleSearch(obj)) {
                    var name = obj.name || file.name.replace('.json', '')
                    s.criteria.all[name] = stripName(obj)
                } else {
                    Object.keys(obj).forEach(name => {
                        s.criteria.all[name] = obj[name]
                    })
                }
                s.criteria.syncSavedAll()
                alert('Import successful!')
            } catch(ex) {
                alert('Invalid JSON file: ' + ex.message)
            }
        }
        reader.readAsText(file)
        e.target.value = ''
    },
    showImportJSON() {
        this.setState({showImportModal: true, importJSON: '', importName: '', importError: null, importValid: false})
    },
    hideImportJSON() {
        this.setState({showImportModal: false})
    },
    onImportJSONChange(e) {
        var text = e.target.value
        var valid = false, error = null, importName = this.state.importName
        try {
            var obj = JSON.parse(text)
            var err = validateCriteria(obj)
            if (err) error = err
            else {
                valid = true
                // Pre-populate name from JSON if it has one
                if (isSingleSearch(obj) && obj.name && !this.state.importName) {
                    importName = obj.name
                }
            }
        } catch(ex) {
            if (text.trim().length > 0) error = 'Invalid JSON: ' + ex.message
        }
        this.setState({importJSON: text, importValid: valid, importError: error, importName: importName})
    },
    doImportJSON() {
        try {
            var obj = JSON.parse(this.state.importJSON)
            if (Array.isArray(obj)) {
                obj.forEach(item => {
                    var name = item.name || 'Imported'
                    s.criteria.all[name] = stripName(item)
                })
            } else if (isSingleSearch(obj)) {
                var name = this.state.importName.trim()
                if (!name) { alert('Please enter a name for this search.'); return }
                s.criteria.all[name] = stripName(obj)
            } else {
                Object.keys(obj).forEach(name => {
                    s.criteria.all[name] = obj[name]
                })
            }
            s.criteria.syncSavedAll()
            this.hideImportJSON()
        } catch(ex) {
            alert('Error: ' + ex.message)
        }
    },
    render() {
        var {selected, loanCount, counting, renaming, renameTo, searches, checked,
             showImportModal, importJSON, importName, importError, importValid,
             showImportFromURL, importFromURLData} = this.state
        var selectedCrit = selected ? s.criteria.syncGetByName(selected) : null
        var summary = selectedCrit ? summarizeCriteria(selectedCrit) : []
        var checkedCount = this.getCheckedNames().length
        var parsedImport = null
        try { parsedImport = importJSON ? JSON.parse(importJSON) : null } catch(e) {}
        var isSingle = parsedImport && isSingleSearch(parsedImport)
        var importSummary = isSingle ? summarizeCriteria(stripName(parsedImport)) : []

        // Count items in URL import
        var urlImportCount = 0
        if (importFromURLData) {
            if (Array.isArray(importFromURLData)) urlImportCount = importFromURLData.length
            else if (isSingleSearch(importFromURLData)) urlImportCount = 1
            else urlImportCount = Object.keys(importFromURLData).length
        }

        return (
            <div>
                {showImportFromURL ?
                    <Alert bsStyle="info" style={{margin: '0 15px 15px'}}>
                        <h4>Import Saved Searches</h4>
                        <p>Someone shared {urlImportCount} saved search{urlImportCount !== 1 ? 'es' : ''} with you. Would you like to import {urlImportCount === 1 ? 'it' : 'them'}?</p>
                        <Button bsStyle="primary" onClick={this.doImportFromURL} style={{marginRight: 8}}>Import</Button>
                        <Button onClick={this.skipImportFromURL}>Skip</Button>
                    </Alert>
                : null}

                <Col md={4}>
                    <h4 style={{marginTop: 5, marginBottom: 8}}>Saved Searches ({searches.length})</h4>
                    <div style={{marginBottom: 6}}>
                        <ButtonGroup bsSize="xsmall">
                            <Button onClick={this.selectAll}>Select All</Button>
                            <Button onClick={this.selectNone}>Select None</Button>
                        </ButtonGroup>
                    </div>
                    <div style={{height: 'calc(100vh - 230px)', overflowY: 'auto'}}>
                        {searches.map(name =>
                            <ListGroupItem
                                key={name}
                                className={cx({active: selected === name})}
                                style={{padding: '4px 8px', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center'}}
                                onClick={this.selectSearch.bind(this, name)}>
                                <input type="checkbox" checked={!!checked[name]}
                                    onChange={this.toggleCheck.bind(this, name)}
                                    onClick={e => e.stopPropagation()}
                                    style={{marginRight: 8, flexShrink: 0}}/>
                                <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{name}</span>
                            </ListGroupItem>
                        )}
                        {searches.length === 0 ?
                            <p style={{color: '#999', padding: 12}}>No saved searches yet.</p>
                        : null}
                    </div>
                    <div style={{paddingTop: 8, borderTop: '1px solid #ddd'}}>
                        <ButtonGroup bsSize="small">
                            <Button onClick={this.exportAll}>Export All</Button>
                            <Button onClick={this.exportSelected} disabled={checkedCount === 0}>Export Selected ({checkedCount})</Button>
                        </ButtonGroup>
                        <div style={{marginTop: 4}}>
                            <ButtonGroup bsSize="small">
                                <Button onClick={this.shareSelected} disabled={checkedCount === 0}>Share Selected</Button>
                                <Button className="btn-file" style={{position: 'relative', overflow: 'hidden'}}>
                                    Import File...
                                    <input type="file" accept=".json" onChange={this.importFile}
                                        style={{position: 'absolute', top: 0, right: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer'}}/>
                                </Button>
                                <Button onClick={this.showImportJSON}>Import JSON...</Button>
                            </ButtonGroup>
                        </div>
                    </div>
                </Col>
                <Col md={8}>
                    {selected && selectedCrit ?
                        <div>
                            <h3 style={{marginTop: 5}}>
                                {renaming ?
                                    <span>
                                        <input type="text" className="form-control" style={{display: 'inline', width: '60%'}}
                                            value={renameTo} onChange={e => this.setState({renameTo: e.target.value})}
                                            onKeyDown={e => { if (e.keyCode === 13) this.doRename() }}
                                            autoFocus/>
                                        <Button bsSize="small" bsStyle="primary" onClick={this.doRename} style={{marginLeft: 8}}>Save</Button>
                                        <Button bsSize="small" onClick={() => this.setState({renaming: false})} style={{marginLeft: 4}}>Cancel</Button>
                                    </span>
                                : selected}
                            </h3>

                            <div style={{marginBottom: 16}}>
                                <span style={{fontSize: 18, fontWeight: 600, color: '#2c6e49'}}>
                                    {counting ? 'Counting...' : loanCount !== null ? numeral(loanCount).format('0,0') + ' matching loans' : ''}
                                </span>
                            </div>

                            <ButtonGroup style={{marginBottom: 16}}>
                                <Button bsStyle="primary" onClick={this.showLoans.bind(this, selected)}>Show Loans</Button>
                                {!renaming ? <Button onClick={this.startRename}>Rename</Button> : null}
                                <Button onClick={this.copyJSON}>Copy JSON</Button>
                                <Button bsStyle="danger" onClick={this.deleteSearch.bind(this, selected)}>Delete</Button>
                            </ButtonGroup>

                            {summary.length > 0 ?
                                <Panel header="Criteria Summary">
                                    <dl className="dl-horizontal" style={{marginBottom: 0}}>
                                        {summary.map((item, i) =>
                                            <span key={i}><dt>{item.label}</dt><dd>{item.value}</dd></span>
                                        )}
                                    </dl>
                                </Panel>
                            :
                                <Panel>
                                    <p style={{color: '#999', marginBottom: 0}}>No specific criteria set (matches all loans)</p>
                                </Panel>
                            }
                        </div>
                    :
                        <div style={{padding: '40px', textAlign: 'center', color: '#999'}}>
                            <h3>Select a saved search</h3>
                            <p>Browse, rename, share, export, and import your saved searches.</p>
                        </div>
                    }
                </Col>

                <Modal show={showImportModal} onHide={this.hideImportJSON}>
                    <Modal.Header closeButton>
                        <Modal.Title>Import Saved Search from JSON</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <p>Paste a saved search JSON below. Get this from "Copy JSON" on any saved search to share with teammates.</p>
                        {isSingle ?
                            <div style={{marginBottom: 8}}>
                                <label>Name for this search:</label>
                                <input type="text" className="form-control" placeholder="Enter a name..."
                                    value={importName} onChange={e => this.setState({importName: e.target.value})}/>
                            </div>
                        : null}
                        <textarea className="form-control" rows={10}
                            placeholder='Paste JSON here...'
                            value={importJSON}
                            onChange={this.onImportJSONChange}
                            style={{fontFamily: 'monospace', fontSize: 12}}/>
                        {importValid ?
                            <Alert bsStyle="success" style={{marginTop: 8, marginBottom: 0}}>
                                <span style={{marginRight: 6}}>&#10003;</span>
                                Valid {isSingle ? 'single search' : Array.isArray(parsedImport) ? `${parsedImport.length} searches` : `collection (${Object.keys(parsedImport).length} searches)`}
                            </Alert>
                        : null}
                        {importError ?
                            <Alert bsStyle="danger" style={{marginTop: 8, marginBottom: 0}}>
                                {importError}
                            </Alert>
                        : null}
                        {importValid && isSingle && importSummary.length > 0 ?
                            <Panel header="Criteria Summary" style={{marginTop: 8}}>
                                <dl className="dl-horizontal" style={{marginBottom: 0}}>
                                    {importSummary.map((item, i) =>
                                        <span key={i}><dt>{item.label}</dt><dd>{item.value}</dd></span>
                                    )}
                                </dl>
                            </Panel>
                        : null}
                    </Modal.Body>
                    <Modal.Footer>
                        <Button bsStyle="primary" onClick={this.doImportJSON}
                            disabled={!importValid || (isSingle && !importName.trim())}>
                            Import
                        </Button>
                        <Button onClick={this.hideImportJSON}>Cancel</Button>
                    </Modal.Footer>
                </Modal>
            </div>
        )
    }
})

export default SavedSearches
