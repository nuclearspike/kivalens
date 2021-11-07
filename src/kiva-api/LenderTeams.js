import PagedKiva from "./PagedKiva"

class LenderTeams extends PagedKiva {
  constructor(lender_id) {
    super(`lenders/${lender_id}/teams.json`, {}, 'teams')
  }
}

export {LenderTeams}
export default LenderTeams
