'use strict'

var ReactLink = require('react/lib/ReactLink')
var extend = require('extend')

//this is sloppy and too app-specific
var LinkedComplexCursorMixin = (cursorName='cursor')=> {
    return {
        ensureGoodCursor(cursor){
            var val = typeof this.getDefaultCursor == 'function'? this.getDefaultCursor() : {}
            this.cursor(extend(true,{},val,cursor.value))
        },
        componentDidMount(){
            this.ensureGoodCursor(this.cursor())
        },
        componentWillReceiveProps(newProps){
            if (newProps[cursorName] != this.cursor())
                this.ensureGoodCursor(newProps[cursorName])
        },
        cursor(val) {
            var c = this.props[cursorName]
            if (val) {
                c.set(val)
            } else
                return c
        },
        linkCursor(key, options = {}) {
            let {inputProcessor=null,okToSet=val=>true,type=''} = options
            var valDefault = (typeof this.getDefaultCursor == 'function')? this.getDefaultCursor(): null
            if (!inputProcessor)
                switch (type) {
                    case 'integer':
                        inputProcessor = str=>parseInt(str)
                        okToSet = val=>!isNaN(val)
                        break
                    case 'float':
                        inputProcessor = str=>parseFloat(str)
                        okToSet = val=>!isNaN(val)
                        break
                    default:
                        inputProcessor = str=>str
                }

            var value = this.cursor().value ? this.cursor().refine(key).value : valDefault[key]

            var receiveValue = val => {
                val = inputProcessor(val)
                if (okToSet(val))
                    this.cursor().refine(key).set(val)
            }

            return new ReactLink(value, receiveValue)
        }
    }
}

//watches for state change on what is defined by the selector/field, it triggers the function (given as string) after delay
const DelayStateTriggerMixin = function(stateSelector, onTrigger, delayTime = 200) {
    //invent a new handle name.
    var handleName = 'DelayTriggerChangedHandle' + Math.random().toString()
    var stateSelectorFunc = typeof stateSelector == 'string' ? state=>state[stateSelector] : stateSelector

    return {
        componentDidUpdate(prevProps, prevState){
            if ((stateSelectorFunc(prevState) != stateSelectorFunc(this.state)) ) { //|| (JSON.stringify(stateSelectorFunc(prevState)) != JSON.stringify(stateSelectorFunc(this.state)))
                clearTimeout(this[handleName])
                this[handleName] = setTimeout(eval(`this.${onTrigger}`), delayTime)
            }
            return true //this is not in the docs, but not having a return true doesn't update the page? bad assumption?
        },
        componentWillUnmount(){clearTimeout(this[handleName])}
    }
}

//NOT USED
const HasCursorMixin = {
    cursor(val){
        var c = this.props.cursor
        if (val) {
            c.set(val)
        } else
            return c
    },
    getCursorFieldValue(name, defVal){
        var c = this.cursor()
        var f
        if (c.value) f = c.refine(name) //this seems hoaky
        return (!c || !f || !f.value) ? defVal : f.value
    }
}

//UGH. you're doing it wrong if you need this.
const ForceRebuildMixin = {
    getInitialState(){
        return {cycle: 0}
    },
    forceRebuild(){
        this.setState({cycle: Math.random()})
    }
}

export {LinkedComplexCursorMixin,DelayStateTriggerMixin}