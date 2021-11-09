const PagedKiva = require('./PagedKiva');

class LenderTeams extends PagedKiva {
  constructor(lender_id) {
    super(`lenders/${lender_id}/teams.json`, {}, 'teams');
  }
}

module.exports = LenderTeams;
