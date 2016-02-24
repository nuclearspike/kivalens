import React from 'react'
import {Grid,Col,Row} from 'react-bootstrap'
import Reflux from 'reflux'
import a from '../actions'
import {Link} from 'react-router'
const LenderLoans = require("../api/kivajs/LenderLoans")

var alreadyLoadedOnce = false
const SnowStack = React.createClass({
    mixins:[Reflux.ListenerMixin],
    getInitialState(){return {message:'Waiting for fundraising loans to load...'}},
    shouldComponentUpdate(np, {message}){return message != this.state.message},
    produceImages(callback){
        alreadyLoadedOnce = true
        var that = this
        const selectImage = loan => {
            var image_id = loan.image.id
            var thumb= `http://www.kiva.org/img/w800/${image_id}.jpg`
            var zoom = thumb //`http://www.kiva.org/img/w800/${image_id}.jpg`
            var link = `http://www.kiva.org/lend/${loan.id}`
            //title:loan.name,
            return {thumb,zoom,link}
        }
        var lid = this.getKivaID()
        if (lid) {
            that.setMessage(`Loading loans for ${lid}...`)
            new LenderLoans(lid, {max_pages: 10}).start().done(loans => {
                that.setMessage(`Loans for ${lid} (up to 200): arrow keys to move, space toggles magnify.`)
                callback(loans.select(selectImage))
            })
        } else {
            that.setMessage('Fundraising loans (Enter your Lender ID in Options to see your portfolio): arrow keys to move, space toggles magnify.')
            var interesting = kivaloans.filter({loan:{tags:['#InterestingPhoto']}},false)
            var popular     = kivaloans.filter({loan:{sort:'popular',limit_results: 300}},false)
            callback(interesting.concat(popular).distinct((a,b)=>a.id==b.id).take(201).select(selectImage))
        }
    },
    setMessage(message){
        this.setState({message})
        this.forceUpdate()
    },
    startIfReady(){
        if (this.getKivaID() || kivaloans.isReady())
            snowstack_init(this.produceImages)
    },
    getKivaID(){
        return this.props.location.query.kivaid || lsj.get('Options').kiva_lender_id
    },
    componentWillUnmount(){
        //todo: save what it was??
        document.getElementsByTagName('body')[0].removeAttribute('style')
    },
    componentDidMount() {
        document.getElementsByTagName('body')[0].setAttribute('style','background-color: black;')
        rga.initialize('UA-10202885-1')
        rga.pageview(this.props.location.search ? '/snowstackWithUser': '/snowstack')
        if (navigator.userAgent.indexOf("WebKit") == -1){
            this.setMessage('Sorry! This feature only works with Safari and Google Chrome browsers. The rest of KivaLens works for everyone!')
            return
        }
        if (alreadyLoadedOnce) {
            this.setMessage('This feature currently only works the first time you visit the page. Just click "Reload" to start over.')
            return
        }
        if (!this.getKivaID())
            this.listenTo(a.loans.load.completed, this.startIfReady)
        this.startIfReady()
    },
    render() {
        return (<div className="snowstack">
            <div className="page view">
                    <div className="origin view">
                        <div id="camera" className="camera view"/>
                    </div>
                </div>
            <div id="caption" className="caption">
                <Link to="/search">Return to KivaLens</Link> Experimental Feature. {this.state.message}
            </div>
        </div>)
    }
})

export default SnowStack