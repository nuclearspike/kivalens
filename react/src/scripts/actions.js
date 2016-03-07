'use strict';

import Reflux from 'reflux'

var a = {loans: null, criteria: null, partners: null, notifications: null, utils: null};

a.loans = Reflux.createActions({
    "live": {children: ['statsChanged','updated','loanNotFundraising','new']},
    "load": {children: ["progressed", "completed", "failed", "descriptions", "secondaryLoad","secondaryStatus","backgroundResyncState"]},
    "filter": {children: ["completed"]},
    "detail": {children: ["completed"]},
    "basket": {children: ["add", "remove","select","changed","batchAdd","clear"]},
    "backgroundResync":{ children: ["removed", "added", "updated"]}, //?
    "refresh": {children: ["completed"]}
})

//used anymore?
a.partners = Reflux.createActions({
    "load": {children: ["completed", "failed"]},
    "filter": {children: ["completed"]},
    "single": {children: ["completed"]}
});

a.criteria  = Reflux.createActions([
    "change","lenderLoansEvent","atheistListLoaded","savedSearchListChanged","switchToSaved","reload","startFresh"
])

a.criteria.balancing = Reflux.createActions({"get": {children: ["completed"]}})

a.notifications = Reflux.createAction({
    children: ["show"]
})

a.utils = Reflux.createAction({
    children: ["prompt"]
})

a.utils.var = Reflux.createActions(["set","get"])

a.utils.modal = Reflux.createActions({
    "partnerDisplay": {children: ["completed"]},
    "alert": {children: ["completed"]}
})

window.kl_actions = a
export default a