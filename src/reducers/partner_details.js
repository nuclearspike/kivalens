import extend from 'extend'
import * as c from '../constants'

/**
 * here's all the partner details.
 * state is an object where the keys are the loan ids
 *
 * state = object with keys being loan ids.
 * { 11111: { id: 11111, name: 'blah' ...}, 22222: { id: 22222, name: 'blah' ...} }
 *
 * */

export default function partnerDetails(state = {}, action) {
  switch (action.type) {
    case c.PARTNER_DETAILS_UPDATE_MANY: {
      // not only adds but also replaces old versions.
      const toAdd = {}
      action.partners.forEach(p => {
        toAdd[p.id] = p
      })
      // overrides old ones, introduces new ones.
      return extend(true, {}, state, toAdd)
    }
    case c.PARTNER_DETAILS_UPDATE:
      return extend(true, {}, state, {[action.partner.id]: action.partner})
    default:
      return state
  }
}
