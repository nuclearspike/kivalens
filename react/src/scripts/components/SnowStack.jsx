import React from 'react'
import {Grid,Col,Row} from 'react-bootstrap'
import Reflux from 'reflux'
import a from '../actions'
import {Link} from 'react-router'
import {LenderLoans} from '../api/kiva'

var alreadyLoadedOnce = false
const SnowStack = React.createClass({
    mixins:[Reflux.ListenerMixin],
    getInitialState(){return {message:'Waiting for fundraising loans to load...'}},
    shouldComponentUpdate(np, {message}){return message != this.state.message},
    produceImages(callback){
        var that = this
        const selectImage = loan => {
            var image_id = loan.image.id
            var thumb= `http://www.kiva.org/img/w800/${image_id}.jpg`
            var zoom = thumb //`http://www.kiva.org/img/w800/${image_id}.jpg`
            var link = `http://www.kiva.org/lend/${loan.id}`
            return ({title:loan.name,thumb,zoom,link})
        }
        alreadyLoadedOnce = true
        var lid = lsj.get('Options').kiva_lender_id
        if (lid) {
            that.setMessage(`Loading loans for ${lid}...`)
            new LenderLoans(lid, {max_pages: 10}).start().done(loans => {
                that.setMessage(`Loans for ${lid} (up to 200): arrow keys to move, space toggles magnify.`)
                callback(loans.select(selectImage))
            })
        } else {
            that.setMessage('Fundraising loans: arrow keys to move, space toggles magnify.')
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
        if (lsj.get('Options').kiva_lender_id || kivaloans.isReady())
            snowstack_init(this.produceImages.bind(this))
    },
    componentWillUnmount(){
        $('body').removeAttr('style') //css({backgroundColor:'white'})
    },
    componentDidMount() {
        $('body').css({backgroundColor:'black'})
        if (alreadyLoadedOnce) {
            this.setMessage('This feature currently only works the first time you visit the page. Just click "Reload" to start over.')
            return
        }
        if (!lsj.get('Options').kiva_lender_id)
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