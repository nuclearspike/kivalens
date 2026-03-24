import React from 'react'
import a from '../actions'
const LenderLoans = require("../api/kivajs/LenderLoans")

const SnowStack = React.createClass({
    getInitialState(){
        return {message:'Loading...'}
    },
    shouldComponentUpdate(np, {message}){return message != this.state.message},
    produceImages(callback){
        var that = this
        const selectImage = loan => {
            var image_id = loan.image.id
            var thumb = `https://www.kiva.org/img/w800/${image_id}.jpg`
            var zoom = thumb
            var link = `https://www.kiva.org/lend/${loan.id}`
            return {thumb,zoom,link}
        }
        var lid = this.getKivaID()
        if (lid) {
            that.safeSetState({message: `Loading loans for ${lid}...`})
            new LenderLoans(lid, {max_pages: 10}).start().done(loans => {
                if (!that._unmounted) {
                    that.safeSetState({message: `${lid}'s portfolio (up to 200): arrow keys to move, space toggles magnify.`})
                    callback(loans.select(selectImage))
                }
            })
        } else {
            that.safeSetState({message: 'Fundraising loans: arrow keys to move, space toggles magnify.'})
            var interesting = kivaloans.filter({loan:{tags:['#InterestingPhoto']}},false)
            var popular = kivaloans.filter({loan:{sort:'popular',limit_results: 300}},false)
            callback(interesting.concat(popular).distinct((a,b)=>a.id==b.id).take(201).select(selectImage))
        }
    },
    safeSetState(state){
        if (!this._unmounted) this.setState(state)
    },
    getKivaID(){
        return (this.props.location && this.props.location.query && this.props.location.query.kivaid) || lsj.get('Options').kiva_lender_id
    },
    startIfReady(){
        console.log('SnowStack.startIfReady: _started=', this._started, '_unmounted=', this._unmounted, 'kivaID=', this.getKivaID(), 'isReady=', kivaloans.isReady())
        if (this._started || this._unmounted) return
        if (this.getKivaID() || kivaloans.isReady()) {
            this._started = true
            setTimeout(() => {
                console.log('SnowStack.setTimeout: _unmounted=', this._unmounted, 'camera=', !!document.getElementById('camera'))
                if (this._unmounted) return
                var el = document.getElementById('camera')
                if (el) {
                    if (typeof snowstack_reset === 'function') snowstack_reset()
                    snowstack_init(this.produceImages)
                }
            }, 100)
        }
    },
    componentWillUnmount(){
        this._unmounted = true
        if (typeof snowstack_cleanup === 'function') snowstack_cleanup()
        if (typeof snowstack_reset === 'function') snowstack_reset()
        document.body.style.removeProperty('background-color')
        document.body.style.removeProperty('overflow')
    },
    componentDidMount() {
        this._unmounted = false
        document.body.style.backgroundColor = 'black'
        document.body.style.overflow = 'hidden'
        this.startIfReady()
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
