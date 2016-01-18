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
    getInitialState() { return {show_graphs: false, canNotify:false, lastSaved: 'initial', saved_searches: s.criteria.syncGetAllNames()} },
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
        //a.loans.filter() //todo: temp??? graphs disappearing.
    },
    criteriaReloaded(crit){
        this.setState({cycle: Math.random().toString(), criteria: crit})  //HACK!!
    },
    clearCriteria(){
        a.criteria.startFresh()
    },
    promptForName(){
        a.utils.prompt({title: "Enter Name for Search Criteria", label: 'Name', callback: s.criteria.syncSaveLastByName})
    },
    toggleGraph(){ this.setState({ show_graphs: !this.state.show_graphs }) },
    render() {
        let {lastSaved,saved_searches,canNotify} = this.state
        let shouldNotifyOnNew = false
        if (lastSaved) {
            var c = s.criteria.syncGetByName(lastSaved)
            if (c)
                shouldNotifyOnNew = c.notifyOnNew
        }
        return (
            <div>
                <h1 style={{marginTop:'0px'}}>Criteria
                    <ButtonGroup className="float_right">
                        <Button className="hidden-xs hidden-sm" onClick={this.toggleGraph}>Graphs</Button>
                        <Button onClick={this.clearCriteria}>Clear</Button>
                        <DropdownButton title={`Saved Search ${lastSaved ? `'${lastSaved}'` : ''}`} id='saved_search' pullRight>
                            <For each='saved' index='i' of={saved_searches}>
                                <MenuItem eventKey={i} key={i} className={cx({'menu_selected': lastSaved == saved})} onClick={a.criteria.switchToSaved.bind(this, saved)}>{saved}</MenuItem>
                            </For>
                            <If condition={saved_searches.length > 0}>
                                <MenuItem divider />
                            </If>
                            <If condition={lastSaved && canNotify}>
                                <MenuItem eventKey={1000} key='notify_on_new' onClick={s.criteria.toggleNotifyOnNew.bind(this, lastSaved)}>{shouldNotifyOnNew ? 'Do NOT ':''}Notify on New for '{lastSaved}'</MenuItem>
                            </If>
                            <If condition={lastSaved}>
                                <MenuItem eventKey={1001} key='save_current' onClick={s.criteria.syncSaveLastByName.bind(this, lastSaved)}>Re-save '{lastSaved}'</MenuItem>
                            </If>
                            <If condition={lastSaved}>
                                <MenuItem eventKey={1002} key='delete_saved' onClick={s.criteria.syncDelete.bind(this, lastSaved)}>Delete '{lastSaved}'</MenuItem>
                            </If>
                            <If condition={lastSaved}>
                                <MenuItem divider />
                            </If>
                            <MenuItem eventKey={1003} key='save_current_as' onClick={this.promptForName}>Save Current Criteria As...</MenuItem>
                        </DropdownButton>
                    </ButtonGroup>
                </h1>
                <If condition={this.state.show_graphs}>
                    <ChartDistribution/>
                </If>
                <CriteriaTabs criteria='pass a cursor'/>
            </div>
        );
    }
})

export default Criteria