class lsj { //localStorage JSON
    static get(key, default_result = {}){
        return $.extend(true, {}, default_result, JSON.parse(localStorage.getItem(key)))
    }
    static getA(key, default_result = []){
        return JSON.parse(localStorage.getItem(key)) || default_result
    }
    static set(key, value){
        localStorage.setItem(key, JSON.stringify(value))
    }
}
window.lsj = lsj

window.perf = function(func){ //need separate for async
    var t0 = performance.now();
    func();
    var t1 = performance.now();
    console.log("Call took " + (t1 - t0) + " milliseconds.")
}

window.setDebugging = function() {
    window.kl_debugging = lsj.get("Options").debugging
}

window.basicReverseOrder = function(a,b) { //this is a hack. OrderBy has issues! Not sure what the conditions are.
    if (a > b) return -1
    if (a < b) return 1
    return 0
}

setDebugging()

window.cl = function() {
    if (window.kl_debugging)
        console.trace(arguments)
}

//this is a common enough pattern in KL that it makes sense to standardize and shorten.
Array.prototype.groupBySelectWithCount = function(selector){
    return this.groupBy(selector).select(g => ({name: selector(g[0]), count: g.length}))
}

Array.prototype.groupBySelectWithSum = function(selector, sumSelector){
    return this.groupBy(selector).select(g => ({name: selector(g[0]), sum: g.sum(sumSelector)}))
}

Array.prototype.percentWhere = function(predicate) {return this.where(predicate).length * 100 / this.length}

//flatten takes a complex array and flattens it [[1,2],[2,3,4]] => [1,2,2,3,4]
Array.prototype.flatten = function(){ return [].concat.apply([], this) }

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