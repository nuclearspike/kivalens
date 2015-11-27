class lsj {
    static get(key, default_result = {}){
        return $.extend(true, {}, JSON.parse(localStorage.getItem(key)), default_result)
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
    console.log("Call to doSomething took " + (t1 - t0) + " milliseconds.")
}

window.setDebugging = function() {
    window.kl_debugging = lsj.get("Options").debugging
}

window.cl = function() {
    if (window.kl_debugging)
        console.trace(arguments)
}

//this is a common enough pattern in KL that it makes sense to standardize and shorten.
Array.prototype.groupSelect = function(selector){
    return this.groupBy(selector).select(g => {return {name: selector(g[0]), count: g.length}})
}

//flatten takes a complex array and flattens it [[1,2],[2,3,4]] => [1,2,2,3,4]
Array.prototype.flatten = function(){ return [].concat.apply([], this) }

//turns var a = [1,2,3,4,5,6,7,8,9,10,11]; a.chunk(5); into => [[1,2,3,4,5],[6,7,8,9,10],[11]]
//added for taking arrays of loan ids and breaking them into the max kiva allows for a request
Array.prototype.chunk = function(chunkSize) {
    var R = []
    for (var i=0; i<this.length; i+=chunkSize)
        R.push(this.slice(i,i+chunkSize))
    return R
}

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

window.humanize = function (str) {
    var frags = str.split('_');
    for (var i=0; i<frags.length; i++) {
        frags[i] = frags[i].charAt(0).toUpperCase() + frags[i].slice(1);
    }
    return frags.join(' ');
}