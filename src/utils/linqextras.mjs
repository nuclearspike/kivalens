
//turns var a = [1,2,3,4,5,6,7,8,9,10,11]; a.chunk(5); into => [[1,2,3,4,5],[6,7,8,9,10],[11]]
//added for taking arrays of loan ids and breaking them into the max kiva allows for a request
//this now has a lodash equivalent... can remove this after conversion
Array.prototype.chunk = function(chunkSize) {
  const R = []
  for (let i=0; i<this.length; i+=chunkSize)
    R.push(this.slice(i,i+chunkSize))
  return R
}

//this is a common enough pattern in KL that it makes sense to standardize and shorten.
Array.prototype.groupByWithCount = function(selector){
  if (!selector) selector = e=>e
  return this.groupBy(selector).map(g => ({name: selector(g[0]), count: g.length}))
}

Array.prototype.groupBySelectWithSum = function(selector, sumSelector){
  return this.groupBy(selector).map(g => ({name: selector(g[0]), sum: g.sum(sumSelector)}))
}

Array.prototype.percentWhere = function(predicate) {return this.filter(predicate).length * 100 / this.length}

//flatten takes a multi dimensional array and flattens it [[1,2],[2,3,4]] => [1,2,2,3,4]
Array.prototype.flatten = function(){ return [].concat.apply([], this) }

export const fundraising = l => l.status === 'fundraising';

Array.prototype.ids = function(){ return this.map(e => e.id)}
Array.prototype.fundraising = function(){ return this.filter(fundraising)}

export const basicReverseOrder = function(a,b) {
  //this is a hack. OrderByDescending has issues! Not sure what the conditions are.
  if (a > b) return -1
  if (a < b) return 1
  return 0
}

export const combineIdsAndLoans = function(ids, details, onlyFundraising = true) {
  let loans = ids.map(id => details[id]).filter(e => e); // remove non-matches.
  if (onlyFundraising) {
    loans = loans.fundraising();
  }
  return loans;
}
