'use strict'

var sem_one = require('semaphore')(8)
var sem_two = require('semaphore')(8)
const Deferred = require("jquery-deferred").Deferred
const extend = require('extend')
require('linqjs')
require('datejs')

var _isServer = false
if (typeof XMLHttpRequest == 'undefined'){
    _isServer = true
    global.XMLHttpRequest = require('xhr2')
}

if (!global.cl)
    global.cl = function(){console.log(...arguments)}

const isServer = () => _isServer
const canWebWork= () => !_isServer && typeof Worker !== 'undefined' && typeof TextEncoder !== 'undefined'
Array.prototype.flatten = Array.prototype.flatten || function(){ return [].concat.apply([], this) }
Array.prototype.percentWhere = function(predicate) {return this.where(predicate).length * 100 / this.length}

const KLPageSplits = 5

var getUrl = function(url, options){
    var d = Deferred()

    options = extend({parseJSON: true, withProgress: true, includeRequestedWith: true}, options)

    function xhrTransferComplete() {
        if (xhr.status == 200) {
            var res = options.parseJSON ? JSON.parse(this.responseText) : this.responseText
            d.resolve(res)
        } else {
            var msg = ''
            if (this.responseText)
                msg = this.responseText

            d.reject(msg, xhr.status)
        }
    }

    function xhrFailed(e){
        var msg = ''
        if (this.responseText)
            msg = this.responseText

        d.reject(msg, xhr.status)
    }

    var xhr = new XMLHttpRequest()
    xhr.addEventListener("load", xhrTransferComplete)
    if (options.withProgress && !isServer())
        xhr.addEventListener("progress", e=>{
            if (e.lengthComputable)
                options.contentLength = e.total

            if (options.contentLength) {
                var notify = {percent: Math.round((e.loaded/options.contentLength)*100), loaded: e.loaded, total: options.contentLength}
                d.notify(notify)
            }
        })
    xhr.addEventListener("error", xhrFailed)
    xhr.addEventListener("abort", xhrFailed)
    xhr.open("GET", url, true)
    xhr.setRequestHeader("Accept", 'application/json,*/*')
    if (options.includeRequestedWith) xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest")
    xhr.send()

    return d
}

//turns {json: 'object', app_id: 'com.me'} into ?json=object&app_id=com.me
function serialize(obj, prefix) {
    var str = []
    for (var p in obj) {
        if (obj.hasOwnProperty(p)) {
            var k = prefix ? prefix + "[" + p + "]" : p,
                v = obj[p]
            str.push(typeof v == "object" ? serialize(v, k) : encodeURIComponent(k) + "=" + encodeURIComponent(v))
        }
    }
    return str.join("&");
}

var api_options = {max_concurrent: 8}

function setAPIOptions(options){
    extend(api_options, options)
    if (api_options.max_concurrent)
        sem_one.capacity = api_options.max_concurrent
}


exports.getUrl = getUrl
exports.KLPageSplits = KLPageSplits
exports.isServer = isServer
exports.canWebWork = canWebWork
exports.sem_one = sem_one
exports.sem_two = sem_two
exports.serialize = serialize
exports.api_options = api_options
exports.setAPIOptions = setAPIOptions