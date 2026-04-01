import React from 'react'
import a from '../actions'
const LenderLoans = require("../api/kivajs/LenderLoans")

const SnowStack = React.createClass({
    getInitialState(){
        return {message:'Loading...', loading: true}
    },
    shouldComponentUpdate(np, {message}){return message != this.state.message},
    selectImage(loan) {
        var image_id = loan.image.id
        var thumb = `https://www.kiva.org/img/w800/${image_id}.jpg`
        return {thumb, zoom: thumb, link: `https://www.kiva.org/lend/${loan.id}`}
    },
    fetchAndInit(){
        var that = this
        var lid = this.getKivaID()
        if (lid) {
            that.safeSetState({message: `Loading loans for ${lid}...`})
            new LenderLoans(lid, {max_pages: 10}).start().done(loans => {
                if (that._unmounted) return
                var images = loans.select(that.selectImage)
                that.removeSpinner()
                that.safeSetState({message: `${lid}'s portfolio (up to 200): arrow keys to move, space toggles magnify.`, loading: false})
                that.initSnowstack(images)
            })
        } else {
            var interesting = kivaloans.filter({loan:{tags:['#InterestingPhoto']}},false)
            var popular = kivaloans.filter({loan:{sort:'popular',limit_results: 300}},false)
            var images = interesting.concat(popular).distinct((a,b)=>a.id==b.id).take(201).select(that.selectImage)
            that.removeSpinner()
            that.safeSetState({message: 'Fundraising loans: arrow keys to move, space toggles magnify.', loading: false})
            that.initSnowstack(images)
        }
    },
    initSnowstack(images) {
        var el = document.getElementById('camera')
        if (!el || this._unmounted) return
        if (typeof snowstack_reset === 'function') snowstack_reset()
        snowstack_init(function(callback) { callback(images) })
    },
    safeSetState(state){
        if (!this._unmounted) this.setState(state)
    },
    getKivaID(){
        return (this.props.location && this.props.location.query && this.props.location.query.kivaid) || lsj.get('Options').kiva_lender_id
    },
    startIfReady(){
        if (this._started || this._unmounted) return
        if (this.getKivaID() || kivaloans.isReady()) {
            this._started = true
            setTimeout(() => {
                if (this._unmounted) return
                this.fetchAndInit()
            }, 100)
        }
    },
    componentWillUnmount(){
        this._unmounted = true
        this.removeSpinner()
        if (typeof snowstack_cleanup === 'function') snowstack_cleanup()
        if (typeof snowstack_reset === 'function') snowstack_reset()
        document.body.style.removeProperty('background-color')
        document.body.style.removeProperty('overflow')
    },
    componentDidMount() {
        this._unmounted = false
        document.body.style.backgroundColor = 'black'
        document.body.style.overflow = 'hidden'
        setTimeout(() => this.addSpinner(), 50)
        this.startIfReady()
    },
    addSpinner() {
        var camera = document.getElementById('camera')
        if (!camera) return
        var style = document.createElement('style')
        style.textContent = '@keyframes spin3d { to { transform: rotateY(360deg) } }'
        document.head.appendChild(style)
        this._spinnerStyle = style

        var wrapper = document.createElement('div')
        wrapper.id = 'kl-wall-spinner'
        wrapper.style.cssText = 'position:absolute;left:50%;top:50%;margin-left:-48px;margin-top:-48px;width:96px;height:96px;-webkit-perspective:600px;perspective:600px;'

        var spinner = document.createElement('div')
        spinner.style.cssText = 'width:96px;height:96px;animation:spin3d 3s linear infinite;'
        spinner.innerHTML = '<img src="/icon-512x512.png" style="width:96px;height:96px;border-radius:16px;opacity:0.8;" />'
        wrapper.appendChild(spinner)
        camera.appendChild(wrapper)
    },
    removeSpinner() {
        var spinner = document.getElementById('kl-wall-spinner')
        if (spinner) spinner.remove()
        if (this._spinnerStyle) { this._spinnerStyle.remove(); this._spinnerStyle = null }
    },
    render() {
        return (<div style={{position: 'fixed', top: 52, left: 0, right: 0, bottom: 0, backgroundColor: 'black', zIndex: 100}}>
            <div className="page view">
                <div className="origin view">
                    <div id="camera" className="camera view"/>
                </div>
            </div>
            <div style={{position: 'fixed', bottom: 0, left: 0, right: 0, padding: '8px 16px', backgroundColor: 'rgba(0,0,0,0.7)', color: '#ccc', fontSize: 13, zIndex: 101}}>
                {this.state.message}
            </div>
        </div>)
    }
})

export default SnowStack
