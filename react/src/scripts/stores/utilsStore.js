import Reflux from 'reflux'
import a from '../actions'

var utilsStore = Reflux.createStore({
    listenables: [a.utils.var],
    init(){
        this.sharedVars = {}
    },
    onGet(name, callback){
        callback(this.sharedVars[name])
    },
    onSet(name, value){
        this.sharedVars[name] = value
    }
})

export default utilsStore