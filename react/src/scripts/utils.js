'use strict'

var extend = require('extend')
var Deferred = require("jquery-deferred").Deferred

class lsj { //localStorage JSON
    static get(key, default_result = {}){
        return extend(true, {}, default_result, JSON.parse(localStorage.getItem(key)))
    }
    static getA(key, default_result = []){
        return JSON.parse(localStorage.getItem(key)) || default_result
    }
    static set(key, value){
        localStorage.setItem(key, JSON.stringify(value))
    }
    static setMerge(key, newStuff){
        lsj.set(key,extend(true, {}, lsj.get(key), newStuff))
    }
}
window.lsj = lsj

window.perf = function(func){ //need separate for async
    var t0 = performance.now();
    func();
    var t1 = performance.now();
    console.log("Call took " + (t1 - t0) + " milliseconds.")
}

window.callKLAFeature = function(feature, params){
    var def = Deferred()
    KLAFeatureCheck([feature]).done(opt => {
        if (opt[feature]) {
            var message = {}
            message[feature] = true
            message.params = params
            chrome.runtime.sendMessage(KLA_Extension, message, reply => def.resolve(reply))
        }
    })
    return def
}

window.KLAdev  = 'egniipplnomjpdlhmmbpmdfbhemdioje'
window.KLAprod = 'jkljjpdljndblihlcoenjbmdakaomhgo'
window.KLA_Extension = window.location.hostname == 'localhost' ? KLAdev : KLAprod

window.getKLAFeatures = function(){
    //either returns the feature array or fails.
    var def = Deferred()
    if (typeof chrome != "undefined") {
        chrome.runtime.sendMessage(KLA_Extension, {getFeatures:true},
            reply => {
                if (reply && reply.features) {
                    def.resolve(reply.features)
                } else {
                    def.reject()
                }
            })
    } else {
        def.reject()
    }
    return def
}

//http://stackoverflow.com/questions/11381673/detecting-a-mobile-browser
window.mobileCheck = function() {
    var check = false;
    (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4)))check = true})(navigator.userAgent||navigator.vendor||window.opera);
    return check;
}

window.mobileAndTabletCheck = function() {
    var check = false;
    (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4)))check = true})(navigator.userAgent||navigator.vendor||window.opera);
    return check;
}

//returns an array of objects of {featureName: bool}
window.KLAFeatureCheck = function(featureArr){
    var def = Deferred()
    var result = {}
    if (!Array.isArray(featureArr)) featureArr = [featureArr]
    featureArr.forEach(feature => result[feature] = false)

    getKLAFeatures()
        .done(features => {
            featureArr.forEach(feature => {
                result[feature] = features.contains(feature)
            })
            def.resolve(result)
        })
        .fail(()=>def.resolve(result))

    return def
}

//with the promise, it will only fire once, domcontent loaded
window.domready = (function(){
    var d = Deferred()
    window.onload = ()=>d.resolve()
    document.addEventListener("DOMContentLoaded",()=>d.resolve())
    return d
})()

//returns just a bool if a single feature is turned on
window.KLAHasFeature = function(featureName) {
    var def = Deferred()

    getKLAFeatures()
        .done(features => def.resolve(features.contains(featureName)))
        .fail(()=>def.resolve(false))

    return def
}

window.KLAOnlyIfFeature = function(feature){
    var def = Deferred()
    KLAHasFeature(feature).done(result => {
        if (result)
            def.resolve()
        else
            def.fail()
    })
    return def
}

window.setDebugging = function() {
    window.kl_debugging = lsj.get("Options").debugging
}

window.basicReverseOrder = function(a,b) { //this is a hack. OrderByDescending has issues! Not sure what the conditions are.
    if (a > b) return -1
    if (a < b) return 1
    return 0
}

setDebugging()

window.cl = function() {
    if (window.kl_debugging)
        console.trace(arguments)
}

//MORE LINQ GOODNESS
//this is a common enough pattern in KL that it makes sense to standardize and shorten.
Array.prototype.groupByWithCount = function(selector=e=>e){
    return this.groupBy(selector).select(g => ({name: selector(g[0]), count: g.length}))
}
//no longer used...
Array.prototype.groupBySelectWithTake = function(selector, take_count = 1){
    return this.groupBy(selector).select(g => ({name: selector(g[0]), taken: g.take(take_count)}))
}

Array.prototype.groupBySelectWithSum = function(selector, sumSelector){
    return this.groupBy(selector).select(g => ({name: selector(g[0]), sum: g.sum(sumSelector)}))
}


//flatten takes a multi dimensional array and flattens it [[1,2],[2,3,4]] => [1,2,2,3,4]
Array.prototype.flatten = function(){ return [].concat.apply([], this) }

//either count() or count(l=>l.status='fundraising') work
Array.prototype.count = function(predicate) {
    return typeof predicate == 'function'? this.where(predicate).length: this.length
}

//turns var a = [1,2,3,4,5,6,7,8,9,10,11]; a.chunk(5); into => [[1,2,3,4,5],[6,7,8,9,10],[11]]
//added for taking arrays of loan ids and breaking them into the max kiva allows for a request
//this now has a lodash equivalent... can remove this after conversion
Array.prototype.chunk = function(chunkSize) {
    var R = []
    for (var i=0; i<this.length; i+=chunkSize)
        R.push(this.slice(i,i+chunkSize))
    return R
}

//I hate this!
window.findBootstrapEnv = function() {
    var envs = ["xs", "sm", "md", "lg"],
        doc = window.document,
        temp = doc.createElement("div")

    doc.body.appendChild(temp)

    for (var i = envs.length - 1; i >= 0; i--) {
        var env = envs[i]

        temp.className = "hidden-" + env

        if (temp.offsetParent === null) {
            doc.body.removeChild(temp)
            return env
        }
    }
    return "";
}

//turns user_favorite => User Favorite
window.humanize = function (str) {
    var frags = str.split('_');
    for (var i=0; i<frags.length; i++) {
        frags[i] = frags[i].charAt(0).toUpperCase() + frags[i].slice(1);
    }
    return frags.join(' ');
}

window.waitFor = function(test, interval = 200) {
    var def = Deferred()
    if (test()) {
        def.resolve()
    } else {
        var handle = setInterval(()=> {
            if (test()) {
                def.resolve()
                clearInterval(handle)
            }
        }, interval)
    }
    return def
}

window.wait = ms => {
    var def = Deferred()
    setTimeout(def.resolve,ms)
    return def
}