'use strict'

import Reflux from 'reflux'

// Kiva has removed their live data stream (streams.kiva.org socket.io).
// This store is kept as a stub so existing imports don't break.

window.channels = {}

var liveStore = Reflux.createStore({ init() {} })

export default liveStore
