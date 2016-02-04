'use strict'

global.basicReverseOrder = function(a,b) { //this is a hack. OrderByDescending has issues! Not sure what the conditions are.
    if (a > b) return -1
    if (a < b) return 1
    return 0
}

//MORE LINQ GOODNESS
//this is a common enough pattern in KL that it makes sense to standardize and shorten.
Array.prototype.groupByWithCount = function(selector){
    if (!selector) selector = e=>e
    return this.groupBy(selector).select(g => ({name: selector(g[0]), count: g.length}))
}
//no longer used...
Array.prototype.groupBySelectWithTake = function(selector, take_count){
    if (!take_count) take_count = 1
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