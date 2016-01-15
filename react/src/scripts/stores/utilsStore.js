import Reflux from 'reflux'
import a from '../actions'

var utilsStore = Reflux.createStore({
    listenables: [a.utils.var],
    init(){
        this.sharedVars = {}
        if (!lsj.get("Options").kiva_lender_id && typeof chrome == "object") {
            callKLAFeature('getLenderId')
                .done(reply => {
                        lsj.setMerge('Options',{kiva_lender_id: reply.lender_id, kiva_lender_id_from_kla: true})
                        kivaloans.setLender(reply.lender_id)
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