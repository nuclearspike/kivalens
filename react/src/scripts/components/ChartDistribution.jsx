'use strict'

import React from 'react'
import Reflux from 'reflux'
import a from '../actions'
import s from '../stores/'
var Highcharts = require('react-highcharts/dist/bundle/highcharts')
import {Collapse,Well} from 'react-bootstrap'

//var timeoutHandle = null;
const ChartDistribution = React.createClass({
    mixins: [Reflux.ListenerMixin],
    getDefaultProps(){return {open: true}},
    getInitialState() {return {countryData: [], sectorData: [], activityData: []}},
    componentDidMount() {
        this.listenTo(a.loans.filter.completed, this.redoCharts)
        this.redoCharts(s.loans.syncFilterLoansLast())
    },
    produceChart(){
        var result = {
            chart: {
                plotBackgroundColor: null,
                plotBorderWidth: 0,
                plotShadow: false,
                animation: false,
                margins: [0,0,0,0]
            },
            title: {
                text: null,
                align: 'center',
                verticalAlign: 'middle',
                y: 40
            },
            tooltip: {
                pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
            },
            plotOptions: {
                pie: {
                    dataLabels: {
                        enabled: true,
                        distance: 10,
                        style: {
                            color: 'black'
                        }
                    },
                    startAngle: -90,
                    endAngle: 90,
                    center: ['50%', '75%']
                },
                series: {
                    animation: false
                }
            },
            credits: {enabled: false},
            series: [
                {
                    type: 'pie',
                    name: 'Countries',
                    center: ["15%", "50%"],
                    innerSize: '70%',
                    data: this.state.countryData
                },
                {
                    type: 'pie',
                    name: 'Sectors',
                    center: ["50%", "50%"],
                    innerSize: '70%',
                    data: this.state.sectorData
                },
                {
                    type: 'pie',
                    name: 'Activities',
                    center: ["85%", "50%"],
                    innerSize: '70%',
                    data: this.state.activityData
                }]
        }
        //a.loans.filter() //this makes me nervous
        return result
    },
    groupByForChart(loans, selector){
        loans.groupBy(selector).select(g=>{return {name: selector(g[0]), y: g.length}})
    },
    redoCharts(loans){
        if (['xs','sm'].contains(findBootstrapEnv())) return
        var countryData  = this.groupByForChart(loans, l=>l.location.country)
        var sectorData   = this.groupByForChart(loans, l=>l.sector)
        var activityData = this.groupByForChart(loans, l=>l.activity)
        this.setState({countryData: countryData, sectorData: sectorData, activityData: activityData})
   },
    render() {
        return (<div className="hidden-xs hidden-sm">
                    <Well>
                        <Highcharts style={{height: '200px'}} config={this.produceChart()} />
                    </Well>
                </div>)
    }
})

export default ChartDistribution