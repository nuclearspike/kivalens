import PagedKiva from './PagedKiva'

class LenderTeams extends PagedKiva {
  constructor(lenderId) {
    super(`lenders/${lenderId}/teams.json`, {}, 'teams')
  }
}

export default LenderTeams
