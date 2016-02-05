"use strict"

import React from 'react'
import Reflux from 'reflux'
import {Grid,Col,Row,Alert,Input,Panel} from 'react-bootstrap'
import {req, LenderTeams} from '../api/kiva'
import numeral from 'numeral'

var Highcharts = require('react-highcharts/dist/bundle/highcharts')

//http://www.kivalens.org/proxy/kiva/ajax/getGraphData?graphName=team_loan_total&id=12965
//http://www.kivalens.org/proxy/kiva/ajax/getGraphData?graphName=team_loan_count&id=12965
//http://www.kivalens.org/proxy/kiva/ajax/getGraphData?graphName=team_new_users&id=12965

const Teams = React.createClass({
    mixins: [Reflux.ListenerMixin],
    getInitialState() {
        this.graph_type = ''
        this.querying = 0
        this.checkedTeams = []
        this.teamData = {} //hmm
        return {teams:[],config:{},querying:0}
    },
    componentDidMount() {
        //this.listenTo(loanActions.filter.completed, this.redoCharts)
        var lender_id = lsj.get('Options').kiva_lender_id
        if (!lender_id) {
            this.setState({error: "You do not have your Kiva Lender ID set on the Options page."})
        } else {
            this.setState({loadingTeams:true})
            new LenderTeams(lender_id).start() //should this be kiva.lender.teams().done(
                .always(x => this.setState({loadingTeams:false}))
                .done(teams => this.setState({teams}))
        }
    },
    refigureChart(){
        var gTypes = document.getElementsByName("graph_type")
        Array.range(0,gTypes.length).forEach(i=>{
            var gTypesChk = gTypes.item(i)
            if (gTypesChk.checked)
                this.graph_type = gTypesChk.value
        })

        //var allTeams = document.getElementsByName("teams[]")
        var allTeams = document.getElementsByName("teams[]")
        this.checkedTeams = []
        Array.range(0,allTeams.length).forEach(i=>{
            var teamChk = allTeams.item(i)
            if (teamChk.checked) {
                this.checkedTeams.push(parseInt(teamChk.value))
                this.guaranteeDataFor(this.graph_type, parseInt(teamChk.value))
            }
        })
    },
    guaranteeDataFor(graphName,teamId){
        //if we already have it... abort.
        if (this.teamData[teamId] && this.teamData[teamId][graphName]) {
            this.produceChart()
            return
        }
        this.querying++
        this.setState({querying: this.querying})
        req.kiva.ajax.get('getGraphData',{graphName,id:teamId})
            .done(result=>{
                this.querying--
                this.setState({querying: this.querying})
                if (!this.teamData[teamId]) this.teamData[teamId] = {}
                this.teamData[teamId][graphName] = result.graphData.select(d=>([parseInt(d[0]),d[1]]))
                this.produceChart()
            }).fail(error => this.setState({error}))
    },
    produceChart(){
        var series = []

        //where -> map??
        this.checkedTeams.forEach(id => {
            if (!this.teamData[id]) return //happens when multiple are loading and not all are finished.
            series.push({type: 'line', name: this.state.teams.first(t=>t.id == id).name, data: this.teamData[id][this.graph_type]})
        })

        var config = {
            chart: {
                zoomType: 'x',
                animation: false
            },
            title: {text: 'Compare Teams'},
            subtitle: {
                text: document.ontouchstart === undefined ?
                    'Click and drag in the plot area to zoom in' : 'Pinch the chart to zoom in'
            },
            xAxis: {
                type: 'datetime',
                dateTimeLabelFormats: {
                    month: '%b `%y',
                    year: '%b `%y'
                },
                title: {text: 'Date'}
            },
            yAxis: {title: {text: ''}},
            tooltip: {
                formatter() {
                    return  '<b>' + this.series.name +'</b><br/>' + new Date(this.x).toString('MMM d, yyyy')
                        + ' - ' + numeral(this.y).format('0,0')
                }
            },
            legend: {enabled: true},
            credits: {enabled: false},
            plotOptions: {line: {animation: false}},
            series
        }
        this.setState({config})
    },
    render() {
        let {error,alert,teams,config,querying,loadingTeams} = this.state
        if (error)
            return <Grid><Alert bsStyle="danger">{error}</Alert></Grid>

        var yt_message = querying > 0 ? ` - Waiting on ${querying} results...`: ''
        if (loadingTeams && !yt_message)
            yt_message = '- Loading teams...'

        return (<Grid>
                <h1>Compare Teams - Beta</h1>
                <p>There are still many improvements that can be made to this feature. Contact me (see About) with ideas.</p>
                <Col md={4}>
                    <form ref="graph_options" name="graph_options" action="">
                        <Panel header="Compare">
                            <Input type="radio" label="Membership"  name="graph_type" onChange={this.refigureChart} value="team_new_users" defaultChecked={true} />
                            <Input type="radio" label="Loan Count"  name="graph_type" onChange={this.refigureChart} value="team_loan_count" />
                            <Input type="radio" label="Loan Amount" name="graph_type" onChange={this.refigureChart} value="team_loan_total" />
                        </Panel>
                        <Panel header={`Your Teams ${yt_message}`}>
                            <ul style={{listStyleType: 'none'}}>
                                <For each="team" index="i" of={teams}>
                                    <li key={i}><Input type="checkbox" name="teams[]" label={team.name} value={team.id} onChange={this.refigureChart} /></li>
                                </For>
                            </ul>
                        </Panel>
                    </form>
                </Col>
                <Col md={8}>
                    <If condition={config.chart}>
                        <Highcharts style={{height:'600px'}} config={config}/>
                    </If>
                </Col>
            </Grid>)
    }
})

export default Teams