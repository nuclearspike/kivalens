"use strict";
import Reflux from 'reflux'
import a from '../actions'
import {req} from '../api/kiva'

var utilsStore = Reflux.createStore({
    listenables: [a.utils.var],
    init(){
        this.lenderObj = null
        this.sharedVars = {}
        var options = lsj.get("Options")
        var lender_id = options.kiva_lender_id
        if (!options.install_id){
            var install_id = 'install_id_' + Math.round(Math.random() * 1000000)
            lsj.setMerge('Options',{install_id})
        }
        if (!lender_id && typeof chrome == "object") {
            callKLAFeature('getLenderId')
                .done(reply => {
                        lsj.setMerge('Options',{kiva_lender_id: reply.lender_id, kiva_lender_id_from_kla: true})
                        kivaloans.setLender(reply.lender_id)
                    })
        }
        this.pullLenderObj(lender_id, true)

        setInterval(function(){
            var lender_id = this.lenderObj? lenderObj.lender_id : 'unknown'
            var install_id = lsj.get("Options").install_id
            var uptime = Math.ceil((Date.now() - window.pageStarted)/ 60000)
            req.kl.get(`heartbeat/${install_id}/${lender_id}/${uptime}`).fail((msg,status) => {
                if (status == 205) location.reload()
            })
            window.rga.event({category: 'heartbeat', action: `${install_id}/${lender_id}`, label: lender_id, value: uptime})
        },5*60000)
    },
    pullLenderObj(lender_id, displayError){
        if (lender_id){
            req.kiva.api.lender(lender_id)
                .done(lender => {
                    this.lenderObj = lender
                    lsj.set("lenderObj",lender)
                })
                .fail((msg,status) => {
                    window.rga.event({category: 'error', action: `BadLenderId:${status}:${msg}`, label: lender_id})
                    if (displayError && (status == 400 || status == 404)) {
                        var hint = 'Did you change it on Kiva recently?'
                        if (status == 400)
                            hint = 'Maybe you used your email address by mistake?'
                        a.utils.modal.alert({title: 'Invalid Lender ID: ' + lender_id, message: `Your lender id is not valid. ${hint} It has been cleared out. Go to Options to set it again.`})
                        lsj.setMerge('Options',{kiva_lender_id: ''})
                        kivaloans.setLender('')
                    }
                })
        }
    },
    onGet(name, callback){
        callback(this.sharedVars[name])
    },
    onSet(name, value){
        this.sharedVars[name] = value
    }
})

export default utilsStore