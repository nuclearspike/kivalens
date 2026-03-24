'use strict'

import React from 'react'
import Reflux from 'reflux'
import {Col, Row, ListGroupItem, Button, ButtonGroup, Panel, Input, Modal, Alert, Label} from 'react-bootstrap'
import a from '../actions'
import s from '../stores/'
import numeral from 'numeral'
import cx from 'classnames'
import extend from 'extend'

function validateCriteria(obj) {
    if (!obj || typeof obj !== 'object') return 'Invalid JSON: not an object'
    // Single search: must have at least loan or partner or portfolio
    if (obj.loan || obj.partner || obj.portfolio) return null
    // Could be a named collection {name: {loan:{}, ...}}
    var keys = Object.keys(obj)
    if (keys.length === 0) return 'No saved searches found in JSON'
    for (var i = 0; i < keys.length; i++) {
        var v = obj[keys[i]]
        if (!v || typeof v !== 'object') return `Invalid search "${keys[i]}": not an object`
        if (!v.loan && !v.partner && !v.portfolio) return `Invalid search "${keys[i]}": missing loan/partner/portfolio`
    }
    return null // valid collection
}

function isSingleSearch(obj) {
    return !!(obj && (obj.loan || obj.partner || obj.portfolio))
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
            showImportModal: false,
            importJSON: '',
            importName: '',
            importError: null,
            importValid: false,
            searches: s.criteria.syncGetAllNames()
        }
    },
    componentDidMount() {
        this.listenTo(a.criteria.savedSearchListChanged, this.refreshList)
    },
    refreshList() {
        this.setState({searches: s.criteria.syncGetAllNames()})
    },
    selectSearch(name) {
        this.setState({selected: name, loanCount: null, counting: true, renaming: false})
        // Count matching loans
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
        // Save with new name, delete old
        s.criteria.all[newName] = crit
        delete s.criteria.all[oldName]
        s.criteria.syncSavedAll()
        this.setState({selected: newName, renaming: false})
    },
    exportAll() {
        var data = JSON.stringify(lsj.get('all_criteria'), null, 2)
        var blob = new Blob([data], {type: 'application/json'})
        var url = URL.createObjectURL(blob)
        var a = document.createElement('a')
        a.href = url
        a.download = 'kivalens-saved-searches.json'
        a.click()
        URL.revokeObjectURL(url)
    },
    copyJSON() {
        var crit = s.criteria.syncGetByName(this.state.selected)
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
                if (isSingleSearch(obj)) {
                    var name = file.name.replace('.json', '')
                    s.criteria.all[name] = obj
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
        // Reset the input so the same file can be re-imported
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
        var valid = false, error = null
        try {
            var obj = JSON.parse(text)
            var err = validateCriteria(obj)
            if (err) error = err
            else valid = true
        } catch(ex) {
            if (text.trim().length > 0) error = 'Invalid JSON: ' + ex.message
        }
        this.setState({importJSON: text, importValid: valid, importError: error})
    },
    doImportJSON() {
        try {
            var obj = JSON.parse(this.state.importJSON)
            if (isSingleSearch(obj)) {
                var name = this.state.importName.trim()
                if (!name) { alert('Please enter a name for this search.'); return }
                s.criteria.all[name] = obj
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
        var {selected, loanCount, counting, renaming, renameTo, searches, showImportModal, importJSON, importName, importError, importValid} = this.state
        var selectedCrit = selected ? s.criteria.syncGetByName(selected) : null
        var summary = selectedCrit ? summarizeCriteria(selectedCrit) : []
        var parsedImport = null
        try { parsedImport = importJSON ? JSON.parse(importJSON) : null } catch(e) {}
        var isSingle = parsedImport && isSingleSearch(parsedImport)

        return (
            <div>
                <Col md={4}>
                    <h4 style={{marginTop: 5, marginBottom: 8}}>Saved Searches ({searches.length})</h4>
                    <div style={{height: 'calc(100vh - 160px)', overflowY: 'auto'}}>
                        {searches.map(name =>
                            <ListGroupItem
                                key={name}
                                className={cx({active: selected === name})}
                                style={{padding: '6px 12px', cursor: 'pointer', fontSize: 13}}
                                onClick={this.selectSearch.bind(this, name)}>
                                {name}
                            </ListGroupItem>
                        )}
                        {searches.length === 0 ?
                            <p style={{color: '#999', padding: 12}}>No saved searches yet. Save one from the Search tab.</p>
                        : null}
                    </div>
                    <div style={{paddingTop: 8, borderTop: '1px solid #ddd'}}>
                        <ButtonGroup>
                            <Button bsSize="small" onClick={this.exportAll} disabled={searches.length === 0}>Export All</Button>
                            <Button bsSize="small" className="btn-file" style={{position: 'relative', overflow: 'hidden'}}>
                                Import File...
                                <input type="file" accept=".json" onChange={this.importFile}
                                    style={{position: 'absolute', top: 0, right: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer'}}/>
                            </Button>
                            <Button bsSize="small" onClick={this.showImportJSON}>Import JSON...</Button>
                        </ButtonGroup>
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
                            <p>Browse, rename, export, and import your saved searches.</p>
                        </div>
                    }
                </Col>

                <Modal show={showImportModal} onHide={this.hideImportJSON}>
                    <Modal.Header closeButton>
                        <Modal.Title>Import Saved Search from JSON</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <p>Paste a saved search JSON below. You can get this from the "Copy JSON" button on any saved search to share with teammates.</p>
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
                                Valid {isSingle ? 'single search' : `collection (${Object.keys(parsedImport).length} searches)`}
                            </Alert>
                        : null}
                        {importError ?
                            <Alert bsStyle="danger" style={{marginTop: 8, marginBottom: 0}}>
                                {importError}
                            </Alert>
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
