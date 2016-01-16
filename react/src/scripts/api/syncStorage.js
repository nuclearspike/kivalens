'use strict'

var Deferred = require("jquery-deferred").Deferred

//http://html5demos.com/js/h5utils.js
global.addEvent = (function() {
    if (typeof document != 'undefined' && document.addEventListener) {
        return function(el, type, fn) {
            if (el && el.nodeName || el === global) {
                el.addEventListener(type, fn, false)
            } else if (el && el.length) {
                for (var i = 0; i < el.length; i++) {
                    addEvent(el[i], type, fn)
                }
            }
        };
    } else {
        return function(el, type, fn) {
            if (el && el.nodeName || el === global) {
                el.attachEvent('on' + type, function() {
                    return fn.call(el, global.event)
                });
            } else if (el && el.length) {
                for (var i = 0; i < el.length; i++) {
                    addEvent(el[i], type, fn)
                }
            }
        };
    }
})()

//my stuff.
class InterTabComm {
    constructor(prefix){
        this.promise = Deferred()
        this.prefix = prefix
        this.bossKey = `boss_${prefix}`
        this.isBoss = false
        this.lastBeatDown = null
        this.id = Math.random() * 1000
        addEvent(global,'storage', this.receiveMessage.bind(this))
        this.whosTheBoss()
        setInterval(this.whosTheBoss.bind(this), 750 + Math.ceil(Math.random() * 100))
    }
    sendMessage(to,channel,message,command){ //to boss?
        if (!command) command = 'message'
        var msgName = this.prefix + "_$$$_" + Date.now() + '_' + this.id
        localStorage.setItem(msgName, JSON.stringify({to:to,channel:channel,message:message,command:command}))
        setTimeout(()=>localStorage.removeItem(msgName),10)
        return this.promise //separate  filter?
    }
    whosTheBoss(){
        var boss = JSON.parse(localStorage.getItem(this.bossKey))
        this.isBoss = (!boss)? true: (boss.bossID == this.id)
        var checkDate =  this.lastBeatDown ? this.lastBeatDown : (boss ? boss.lastDeclaration : (3).minutes().ago().getTime())
        var timeDiff = Date.now() - checkDate
        if (!this.isBoss && (timeDiff > 10000)){
            this.isBoss = true
            console.log(`timeDiff: ${timeDiff}`)
        }
        if (this.isBoss)
            localStorage.setItem(this.bossKey, JSON.stringify({bossID: this.id, lastDeclaration: Date.now()}))
        //cl(`${this.id} is ${this.isBoss ? '': 'NOT '}the boss`)
    }
    listen(){
        return this.promise
    }
    filter(p_to,p_channel){
        var $d = Deferred()
        this.promise.progress(r =>{
            if (r.to == p_to && r.channel == p_channel) {
                switch(r.command){
                    case 'message':
                        $d.notify(r.message)
                        break
                    case 'close':
                        $d.resolve(r.message)
                        break
                    case 'fail':
                        $d.reject(r.message)
                        break
                }
            }
        })
        return $d
    }
    receiveMessage(event){
        //another app is declaring they are boss, so that means we're not.
        if (event.key == this.bossKey) {
            //only clients receive this message
            this.lastBeatDown = Date.now()
            this.isBoss = false
            return
        }

        var chunks = event.key.split('_$$$_')
        if (chunks.length <= 1) return
        if (event.newValue) { //null for deletions.
            var msg = JSON.parse(event.newValue)
            if ((msg.to == 'boss' && this.isBoss) || (msg.to == 'client' && !this.isBoss))
                this.promise.notify(msg)
        }
    }
}

class WatchLocalStorage {
    constructor(keys,callback){
        this.keys = (Array.isArray(keys)) ? keys : [keys]
        this.callback = callback
        addEvent(global,'storage',this.receiveMessage.bind(this))
    }
    receiveMessage(event){
        if (this.keys.includes(event.key)) {
            this.callback(event.key,event.newValue)
        }
    }
}

global.WatchLocalStorage = WatchLocalStorage
global.SyncStorage = InterTabComm

exports.WatchLocalStorage = WatchLocalStorage
exports.InterTabComm = InterTabComm