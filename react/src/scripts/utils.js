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

//turns var a = [1,2,3,4,5,6,7,8,9,10,11]; a.chunk(5); into => [[1,2,3,4,5],[6,7,8,9,10],[11]]
//added for taking arrays of loan ids and breaking them into the max kiva allows for a request
Array.prototype.chunk = function(chunkSize) {
    var R = [];
    for (var i=0; i<this.length; i+=chunkSize)
        R.push(this.slice(i,i+chunkSize));
    return R;
}

//not the best name... but i need this for all kiva dates
Date.from_iso = (s) => { return new Date(s) } //get rid of this now that i have the new datejs lib

window.findBootstrapEnv = function() {
    var envs = ["xs", "sm", "md", "lg"],
        doc = window.document,
        temp = doc.createElement("div");

    doc.body.appendChild(temp);

    for (var i = envs.length - 1; i >= 0; i--) {
        var env = envs[i];

        temp.className = "hidden-" + env;

        if (temp.offsetParent === null) {
            doc.body.removeChild(temp);
            return env;
        }
    }
    return "";
}