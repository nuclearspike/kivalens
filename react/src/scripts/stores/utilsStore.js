"use strict";
import Reflux from 'reflux'
import a from '../actions'
import {req} from '../api/kiva'

var utilsStore = Reflux.createStore({
    listenables: [a.utils.var],
    init(){
        this.lenderObj = {}
        this.sharedVars = {}
        var lender_id = lsj.get("Options").kiva_lender_id
        if (!lender_id && typeof chrome == "object") {
            callKLAFeature('getLenderId')
                .done(reply => {
                        lsj.setMerge('Options',{kiva_lender_id: reply.lender_id, kiva_lender_id_from_kla: true})
                        kivaloans.setLender(reply.lender_id)
                    })
        }
        if (lender_id){
            req.kiva.api.lender(lender_id)
                .done(lender => this.lenderObj = lender)
                .fail((msg,status) => {
                    window.rga.event({category: 'error', action: `BadLenderId:${status}:${msg}`, label: lender_id})
                    if (status == 400 || status == 404) {
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