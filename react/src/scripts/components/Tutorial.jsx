'use strict'
import React from 'react'
import {Button} from 'react-bootstrap'

const STEPS = [
    {
        title: 'Welcome to KivaLens!',
        text: "Let's take a quick tour of the main features. You can exit this tutorial at any time.",
        target: null, // centered overlay
        position: 'center'
    },
    {
        title: 'Search Criteria',
        text: 'This is where you filter loans. Try changing a country, sector, or adjusting the repayment slider. Results update instantly.',
        target: '.col-lg-4:first-child', // whole criteria column
        position: 'right',
        hash: '#/search'
    },
    {
        title: 'Saved Searches',
        text: 'Click "Saved Searches" to load preset searches like "Expiring Soon" or save your own custom filters.',
        target: '#saved_search',
        position: 'below'
    },
    {
        title: 'Loan List',
        text: "These are your matching loans. Click any loan to see its details, repayment schedule, and partner info.",
        target: '.loan_list_container',
        position: 'left'
    },
    {
        title: 'Add to Basket',
        text: 'Click a loan from the list, then click the green "Add to Basket" button. You can review everything in the Basket tab before checking out on Kiva.',
        target: '.btn-success.float_right',
        position: 'below',
        fallbackText: 'Try clicking a loan from the list first — you\'ll see an "Add to Basket" button appear in the loan details.'
    },
    {
        title: 'Your Basket',
        text: 'The Basket tab shows your selected loans. When ready, click "Transfer to Kiva" to complete your loans on Kiva\'s site.',
        target: 'a[href="#/basket"]',
        position: 'below',
    },
    {
        title: 'Set Your Lender ID',
        text: 'Enter your Kiva lender ID so KivaLens can hide loans you\'ve already funded and enable portfolio balancing.',
        target: 'a[href="#/options"]',
        position: 'below',
    },
    {
        title: "You're all set!",
        text: "That's the basics! Explore the Partners tab to research field partners, or check out the Saved tab to manage your searches. Happy lending!",
        target: null,
        position: 'center'
    }
]

const Tutorial = React.createClass({
    getInitialState() {
        var step = parseInt(localStorage.getItem('kl_tutorial_step'))
        var done = localStorage.getItem('kl_tutorial_done')
        return {
            active: !isNaN(step) && !done,
            step: isNaN(step) ? 0 : step
        }
    },
    componentDidMount() {
        window.addEventListener('kl_tutorial_start', this.startTutorial)
    },
    componentWillUnmount() {
        window.removeEventListener('kl_tutorial_start', this.startTutorial)
    },
    startTutorial() {
        localStorage.setItem('kl_tutorial_step', '0')
        localStorage.removeItem('kl_tutorial_done')
        this.setState({active: true, step: 0})
    },
    next() {
        var nextStep = this.state.step + 1
        if (nextStep >= STEPS.length) {
            this.finish()
            return
        }
        var stepData = STEPS[nextStep]
        if (stepData.hash) {
            window.location.hash = stepData.hash
        }
        localStorage.setItem('kl_tutorial_step', nextStep.toString())
        this.setState({step: nextStep})
    },
    prev() {
        var prevStep = Math.max(0, this.state.step - 1)
        var stepData = STEPS[prevStep]
        if (stepData.hash) {
            window.location.hash = stepData.hash
        }
        localStorage.setItem('kl_tutorial_step', prevStep.toString())
        this.setState({step: prevStep})
    },
    finish() {
        localStorage.setItem('kl_tutorial_done', 'true')
        localStorage.removeItem('kl_tutorial_step')
        this.setState({active: false})
    },
    getTargetRect() {
        var stepData = STEPS[this.state.step]
        if (!stepData.target) return null
        var el = document.querySelector(stepData.target)
        if (!el) return null
        return el.getBoundingClientRect()
    },
    render() {
        if (!this.state.active) return null

        var step = STEPS[this.state.step]
        var rect = this.getTargetRect()
        var isCenter = step.position === 'center' || !rect
        var displayText = (!rect && step.fallbackText) ? step.fallbackText : step.text
        var stepNum = this.state.step
        var totalSteps = STEPS.length

        // Calculate tooltip position
        var tooltipStyle = {
            position: 'fixed',
            zIndex: 10002,
            background: '#fff',
            border: '2px solid #2c6e49',
            borderRadius: 8,
            padding: '16px 20px',
            maxWidth: 360,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }

        if (isCenter) {
            tooltipStyle.top = '50%'
            tooltipStyle.left = '50%'
            tooltipStyle.transform = 'translate(-50%, -50%)'
        } else {
            if (step.position === 'below') {
                tooltipStyle.top = rect.bottom + 12
                tooltipStyle.left = Math.max(10, rect.left + rect.width / 2 - 180)
            } else if (step.position === 'right') {
                tooltipStyle.top = Math.max(10, rect.top)
                tooltipStyle.left = rect.right + 12
            } else if (step.position === 'left') {
                tooltipStyle.top = Math.max(10, rect.top)
                tooltipStyle.right = window.innerWidth - rect.left + 12
            }
        }

        // Highlight ring around target
        var highlightStyle = null
        if (rect) {
            highlightStyle = {
                position: 'fixed',
                zIndex: 10001,
                top: rect.top - 4,
                left: rect.left - 4,
                width: rect.width + 8,
                height: rect.height + 8,
                border: '3px solid #2c6e49',
                borderRadius: 6,
                pointerEvents: 'none',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
            }
        }

        return (
            <div>
                {/* Dark overlay */}
                {isCenter ? <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', zIndex: 10000
                }} /> : null}

                {/* Highlight target */}
                {highlightStyle ? <div style={highlightStyle} /> : null}

                {/* Tooltip */}
                <div style={tooltipStyle}>
                    <div style={{fontSize: 11, color: '#999', marginBottom: 4}}>
                        Step {stepNum + 1} of {totalSteps}
                    </div>
                    <h4 style={{marginTop: 0, marginBottom: 8, color: '#2c6e49'}}>{step.title}</h4>
                    <p style={{marginBottom: 12, fontSize: 13, lineHeight: 1.5}}>{displayText}</p>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <Button bsSize="small" onClick={this.finish} style={{color: '#fff'}}>Skip Tutorial</Button>
                        <div>
                            {stepNum > 0 ?
                                <Button bsSize="small" onClick={this.prev} style={{marginRight: 6}}>Back</Button>
                            : null}
                            <Button bsSize="small" bsStyle="success" onClick={this.next}>
                                {stepNum === totalSteps - 1 ? 'Finish' : 'Next'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
})

export default Tutorial
