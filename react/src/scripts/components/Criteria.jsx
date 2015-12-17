'use strict'

import React from 'react'
import Reflux from 'reflux'
import {Grid,Row,Col,Input,Button,Tabs,Tab,DropdownButton,MenuItem,ButtonGroup} from 'react-bootstrap'
import LocalStorageMixin from 'react-localstorage'
import {ChartDistribution,CriteriaTabs} from '.'
import a from '../actions'
import s from '../stores/'

const Criteria = React.createClass({
    mixins: [Reflux.ListenerMixin, LocalStorageMixin],
    getInitialState() { return {show_graphs: false, saved_searches: s.criteria.syncGetAllNames()} },
    getStateFilterKeys() { return ['show_graphs']},
    componentDidMount(){
        this.listenTo(a.criteria.savedSearchListChanged, this._savedSearchListChanged )
        this.listenTo(a.criteria.reload, this.criteriaReloaded)
        this._savedSearchListChanged()
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
        cl("promptForName()")
        var options = {title: "Enter Name for Search Criteria", label: 'Name', callback: s.criteria.syncSaveLastByName}
        a.utils.prompt(options)
    },
    toggleGraph(){ this.setState({ show_graphs: !this.state.show_graphs }) },
    render() {
        var tab_key = this.state.lastSaved + this.state.cycle
        return (
            <div>
                <h1 style={{marginTop:'0px'}}>Criteria
                    <ButtonGroup className="float_right">
                        <Button className="hidden-xs hidden-sm" onClick={this.toggleGraph}>Graphs</Button>
                        <Button onClick={this.clearCriteria}>Clear</Button>
                        <DropdownButton title={`Saved Search ${this.state.lastSaved ? "'" + this.state.lastSaved + "'" : ''}`} id='saved_search' pullRight>
                            <For each='saved' index='i' of={this.state.saved_searches}>
                                <MenuItem eventKey={i} key={i} onClick={a.criteria.switchToSaved.bind(this, saved)}>{saved}</MenuItem>
                            </For>
                            <If condition={this.state.saved_searches.length > 0}>
                                <MenuItem divider />
                            </If>
                            <If condition={this.state.lastSaved}>
                                <MenuItem eventKey={1001} key='save_current' onClick={s.criteria.syncSaveLastByName.bind(this, this.state.lastSaved)}>Re-save '{this.state.lastSaved}'</MenuItem>
                            </If>
                            <If condition={this.state.lastSaved}>
                                <MenuItem eventKey={1002} key='delete_saved' onClick={s.criteria.syncDelete.bind(this, this.state.lastSaved)}>Delete '{this.state.lastSaved}'</MenuItem>
                            </If>
                            <If condition={this.state.lastSaved}>
                                <MenuItem divider />
                            </If>
                            <MenuItem eventKey={1003} key='save_current_as' onClick={this.promptForName}>Save Current Criteria As...</MenuItem>
                        </DropdownButton>
                    </ButtonGroup>
                </h1>
                <If condition={this.state.show_graphs}>
                    <ChartDistribution/>
                </If>
                <CriteriaTabs key={tab_key} criteria='pass a cursor'/>
            </div>
        );
    }
})

export default Criteria