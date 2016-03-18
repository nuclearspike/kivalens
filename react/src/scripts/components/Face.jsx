"use strict";

import React from 'react'
import ReactDOM from 'react-dom'
import Reflux from 'reflux'
import {Grid,Col,Row} from 'react-bootstrap'
const LenderLoans = require("../api/kivajs/LenderLoans")

const Face = React.createClass({
    mixins: [Reflux.ListenerMixin],
    getInitialState() {
        return {images:[]}
    },
    componentDidMount() {
        setTimeout(function() {
            var videoInput = document.getElementById('inputVideo')
            var canvasInput = document.getElementById('inputCanvas')

            var htracker = new headtrackr.Tracker()
            htracker.init(videoInput, canvasInput)
            htracker.start()
        }, 1000)

        if (/webkit/i.test(navigator.userAgent)) {
            document.addEventListener('headtrackingEvent', this.onHeadTrackingMove.bind(this))
            //document.addEventListener('facetrackingEvent', this.onFaceTrackingMove.bind(this))
        }
        this.fetchPortfolio()
    },
    fetchPortfolio(){
        const selectImage = loan => {
            var image_id = loan.image.id
            var thumb= `http://www.kiva.org/img/w800/${image_id}.jpg`
            var zoom = thumb //`http://www.kiva.org/img/w800/${image_id}.jpg`
            var link = `http://www.kiva.org/lend/${loan.id}`
            return {thumb,zoom,link}
        }
        const that = this
        var lid = lsj.get('Options').kiva_lender_id
        if (lid) {
            that.setMessage(`Loading loans for ${lid}...`)
            new LenderLoans(lid, {max_pages: 10}).start().done(loans => {
                that.setMessage(`Loans for ${lid} (up to 200): arrow keys to move, space toggles magnify.`)
                that.setState({images: loans.select(selectImage)})
            })
        } else {
            that.setMessage('Fundraising loans (Enter your Lender ID in Options to see your portfolio): arrow keys to move, space toggles magnify.')
            var interesting = kivaloans.filter({loan:{tags:['#InterestingPhoto']}},false)
            var popular     = kivaloans.filter({loan:{sort:'popular',limit_results: 300}},false)
            that.setState({images: interesting.concat(popular).distinct((a,b)=>a.id==b.id).take(201).select(selectImage)})
        }
    },
    setMessage(message){
        this.setState({message})
        this.forceUpdate()
    },
    onFaceTrackingMove(e){
        //e facetrack: {"isTrusted":false,"height":132,"width":92,"angle":1.5707963267948966,"x":113,"y":174,"confidence":1,"detection":"CS","time":7}
        //console.log('facetrack:',JSON.stringify(e))
    },
    onHeadTrackingMove(e){
        //e headtrack: {"isTrusted":false,"x":-1.0446648670215357,"y":6.2248671992126905,"z":60.7286646139263}
        var d = ReactDOM.findDOMNode(this.refs.page)
        var x = (e.x * 400) + (document.body.clientWidth / 2)
        var y = document.body.scrollTop + (e.y * 500)
        var z = e.z * 70
        d.setAttribute('style',`-webkit-perspective-origin: ${x}px ${y}px`)
        d.setAttribute('style',`-webkit-perspective: ${z}px`)
        console.log(JSON.stringify(e))
    },
    randomBetween(low,high){
        return Math.floor(Math.random() * (high - low + 1)) - low
    },
    render() {
        let {images} = this.state
        return (
            <div ref="page" className="facepage">
                <canvas id="inputCanvas" width="320" height="240" style={{display:'none'}}> </canvas>
                <video id="inputVideo" autoPlay loop> </video>
                {images.map((url,i)=>{
                    var z = this.randomBetween(-200,200)
                    return <img src={url.thumb} key={i}
                                style={{maxWidth:200, maxHeight:200,zIndex:z,
                                transform:`rotateY(${this.randomBetween(-5,5)}deg) translate3d(${this.randomBetween(-100,100)}px,${this.randomBetween(-50,50)}px,${z}px)`}} />
                })}
            </div>
        )
    }
})

export default Face