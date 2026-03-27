'use strict'

import React from 'react'
import Reflux from 'reflux'
import {Grid,Row,Col,Input,Button,Tabs,Tab,DropdownButton,MenuItem,ButtonGroup} from 'react-bootstrap'
import LocalStorageMixin from 'react-localstorage'
import {ChartDistribution,CriteriaTabs} from '.'
import a from '../actions'
import s from '../stores/'
import cx from 'classnames'

const Criteria = React.createClass({
    mixins: [Reflux.ListenerMixin, LocalStorageMixin],
    getInitialState() { return {show_graphs: false, canNotify:false, lastSaved: 'initial', saved_searches: s.criteria.syncGetAllNames(), searchCounts: {}} },
    getStateFilterKeys() { return ['show_graphs']},
    componentDidMount(){
        this.listenTo(a.criteria.savedSearchListChanged, this._savedSearchListChanged)
        this.listenTo(a.criteria.reload, this.criteriaReloaded)
        this._savedSearchListChanged()
        KLAOnlyIfFeature('notify').done(x =>this.setState({canNotify:true}))
    },
    _savedSearchListChanged(){
        var newState = {}
        newState.saved_searches = s.criteria.syncGetAllNames()
        newState.lastSaved = s.criteria.syncGetLastSwitch()
        this.setState(newState)
    },
    computeSearchCounts(){
        if (this._countsComputed) return
        this._countsComputed = true
        var counts = {}
        var names = s.criteria.syncGetAllNames()
        var allLoans = kivaloans.loans_from_kiva.where(l => l.status == 'fundraising')
        names.forEach(name => {
            try {
                var crit = s.criteria.syncGetByName(name)
                if (crit) {
                    var filtered = kivaloans.filter(crit, false, allLoans)
                    counts[name] = filtered.length
                }
            } catch(e) { counts[name] = '?' }
        })
        this.setState({searchCounts: counts})
    },
    criteriaReloaded(criteria){
        this.setState({criteria})
    },
    clearCriteria(){
        a.criteria.startFresh()
    },
    promptForName(){
        a.utils.prompt({title: "Enter Name for Search Criteria", label: 'Name', callback: s.criteria.syncSaveLastByName})
    },
    toggleNotify(name){
        if (s.criteria.toggleNotifyOnNew(name))
            callKLAFeature("notify", `You have switched on notifications for '${name}'! Listen for the sound played with this popup!`)
    },
    toggleGraph(){ this.setState({ show_graphs: !this.state.show_graphs }) },
    render() {
        let {lastSaved,saved_searches,canNotify,show_graphs} = this.state
        let shouldNotifyOnNew = false
        if (lastSaved) {
            var c = s.criteria.syncGetByName(lastSaved)
            if (c)
                shouldNotifyOnNew = c.notifyOnNew
        }

        //SAVED SEARCH MENU ITEMS
        var {searchCounts} = this.state
        var menuItems = saved_searches.map((saved,i) => {
            var count = searchCounts[saved]
            return <MenuItem eventKey={i} key={i} className={cx({'menu_selected': lastSaved == saved})} onClick={a.criteria.switchToSaved.bind(this, saved)}>
                {count !== undefined ? <span className="saved-search-count">{count}</span> : null}
                {saved}
            </MenuItem>
        })
        if (menuItems.length) {
            menuItems.push(<MenuItem divider key="divider-saved" />)
        }
        if (lastSaved) {
            if (canNotify)
                menuItems.push(<MenuItem eventKey={1000} key='notify_on_new' onClick={this.toggleNotify.bind(this, lastSaved)}>{shouldNotifyOnNew ? 'Do NOT ':''}Notify on New for '{lastSaved}'</MenuItem>)
            menuItems.push(<MenuItem eventKey={1001} key='save_current' onClick={s.criteria.syncSaveLastByName.bind(this, lastSaved)}>Re-save '{lastSaved}'</MenuItem>)
            menuItems.push(<MenuItem eventKey={1002} key='delete_saved' onClick={s.criteria.syncDelete.bind(this, lastSaved)}>Delete '{lastSaved}'</MenuItem>)
            menuItems.push(<MenuItem divider key="divider-actions" />)
        }
        menuItems.push(<MenuItem eventKey={1003} key='save_current_as' onClick={this.promptForName}>Save Current Criteria As...</MenuItem>)

        return (
            <div>
                <div style={{display: 'flex', gap: 4, marginBottom: 8, alignItems: 'center'}}>
                    <Button bsSize="small" onClick={this.clearCriteria} style={{whiteSpace: 'nowrap'}}>Reset</Button>
                    <DropdownButton title={`${lastSaved ? `'${lastSaved}'` : 'Saved Searches'}`} id='saved_search' bsSize="small" style={{flex: 1}} onToggle={(isOpen) => { if (isOpen) { this._countsComputed = false; this.computeSearchCounts() } }}>
                        {menuItems}
                    </DropdownButton>
                </div>
                <div style={{marginBottom: 8, fontSize: 11}}>
                    <a href="#/saved">Manage Saved Searches</a>
                </div>
                <CriteriaTabs criteria='pass a cursor'/>
            </div>
        );
    }
})

export default Criteria