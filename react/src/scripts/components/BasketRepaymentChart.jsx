'use strict'

import React from 'react'
import {Panel, Alert} from 'react-bootstrap'
import numeral from 'numeral'
var Highcharts = require('react-highcharts/bundle/ReactHighcharts')

function computeBasketRepaymentForecast(basket_items) {
    var monthMap = {}
    var skippedCount = 0

    basket_items.forEach(bi => {
        if (!bi.loan || !bi.loan.kl_still_needed || !bi.loan.kl_repayments || !bi.loan.kl_repayments.length || !bi.loan.loan_amount) {
            skippedCount++
            return
        }

        var lenderShare = bi.amount / bi.loan.loan_amount

        bi.loan.kl_repayments.forEach(repayment => {
            var key = repayment.display
            if (!monthMap[key]) {
                monthMap[key] = {date: repayment.date, total: 0}
            }
            monthMap[key].total += repayment.amount * lenderShare
        })
    })

    var months = Object.keys(monthMap)
        .select(key => ({key: key, date: monthMap[key].date, amount: monthMap[key].total}))
        .orderBy(m => m.date)

    var cumulative = 0
    var categories = []
    var amounts = []
    var cumulativeAmounts = []

    months.forEach(m => {
        categories.push(m.key)
        amounts.push(parseFloat(m.amount.toFixed(2)))
        cumulative += m.amount
        cumulativeAmounts.push(parseFloat(cumulative.toFixed(2)))
    })

    return {categories, amounts, cumulativeAmounts, skippedCount}
}

const BasketRepaymentChart = React.createClass({
    produceConfig(categories, amounts, cumulativeAmounts) {
        return {
            chart: {
                alignTicks: false,
                type: 'bar',
                animation: false
            },
            title: {text: null},
            xAxis: {
                categories: categories,
                title: {text: null},
                labels: {style: {fontSize: '10px'}}
            },
            yAxis: [{
                min: 0,
                title: {text: 'Monthly'},
                labels: {
                    formatter: function () { return '$' + numeral(this.value).format('0,0[.]00') }
                }
            }, {
                min: 0,
                title: {text: 'Cumulative'},
                opposite: true,
                labels: {
                    formatter: function () { return '$' + numeral(this.value).format('0,0[.]00') }
                }
            }],
            tooltip: {
                shared: true,
                valuePrefix: '$',
                valueDecimals: 2
            },
            plotOptions: {
                column: {
                    dataLabels: {enabled: false}
                },
                area: {
                    marker: {enabled: false},
                    dataLabels: {enabled: false}
                }
            },
            legend: {enabled: true},
            credits: {enabled: false},
            series: [{
                type: 'bar',
                animation: false,
                zIndex: 6,
                name: 'Monthly Repayment',
                color: '#e8871a',
                data: amounts
            }, {
                type: 'area',
                animation: false,
                yAxis: 1,
                zIndex: 5,
                name: 'Cumulative',
                color: '#2c6e49',
                fillColor: 'rgba(44, 110, 73, 0.15)',
                data: cumulativeAmounts
            }]
        }
    },
    render() {
        var {basket_items, amount_sum} = this.props
        var {categories, amounts, cumulativeAmounts, skippedCount} = computeBasketRepaymentForecast(basket_items)

        if (!categories.length) {
            if (skippedCount > 0) {
                return <Panel>
                    <Alert bsStyle="info">Repayment schedule data is not yet available for the loans in your basket.</Alert>
                </Panel>
            }
            return null
        }

        var totalBack = cumulativeAmounts.length ? cumulativeAmounts[cumulativeAmounts.length - 1] : 0
        var config = this.produceConfig(categories, amounts, cumulativeAmounts)
        var chartHeight = Math.max(300, Math.min(categories.length * 22, 900))

        return (
            <Panel>
                <h4>Repayments for Basket: {categories.length} months</h4>
                {skippedCount > 0 ?
                    <Alert bsStyle="warning">
                        Repayment data unavailable for {skippedCount} of {basket_items.length} loans.
                    </Alert>
                : null}
                <Highcharts style={{height: chartHeight + 'px'}} config={config} />
            </Panel>
        )
    }
})

export default BasketRepaymentChart
