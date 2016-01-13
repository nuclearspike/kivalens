'use strict'

//http://html5demos.com/js/h5utils.js
window.addEvent = (function() {
    if (document.addEventListener) {
        return function(el, type, fn) {
            if (el && el.nodeName || el === window) {
                el.addEventListener(type, fn, false);
            } else if (el && el.length) {
                for (var i = 0; i < el.length; i++) {
                    addEvent(el[i], type, fn);
                }
            }
        };
    } else {
        return function(el, type, fn) {
            if (el && el.nodeName || el === window) {
                el.attachEvent('on' + type, function() {
                    return fn.call(el, window.event);
                });
            } else if (el && el.length) {
                for (var i = 0; i < el.length; i++) {
                    addEvent(el[i], type, fn);
                }
            }
        };
    }
})()

class SyncStorage {
    constructor(prefix){
        this.promise = $.Deferred() //UGH
        this.prefix = prefix
        addEvent(window,'storage', this.receiveMessage.bind(this))
    }
    sendMessage(channel,message){
        var msgName = this.prefix + "_$$$_" + Date.today().getTime() + '_' + Math.random().toString()
        localStorage.setItem(msgName, JSON.stringify({channel,message}))
        setTimeout(()=>{localStorage.removeItem(msgName)},10000)
    }
    listen(){
        return this.promise
    }
    receiveMessage(event){
        console.log(`event: ${event.key}`)
        var chunks = event.key.split('_$$$_')
        if (chunks.length <= 1) return
        if (event.newValue)
            this.promise.notify(JSON.parse(event.newValue))
    }
}

class WatchLocalStorage {
    constructor(keys,callback){
        this.keys = (Array.isArray(keys)) ? keys : [keys]
        this.callback = callback
        addEvent(window,'storage',this.receiveMessage.bind(this))
    }
    receiveMessage(event){
        if (this.keys.includes(event.key)) {
            this.callback(event.key,event.newValue)
        }
    }
}

window.WatchLocalStorage = WatchLocalStorage
window.SyncStorage = SyncStorage

export {WatchLocalStorage, SyncStorage}