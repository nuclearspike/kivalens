import { PagedKiva } from './PagedKiva'

export class LenderTeams extends PagedKiva {
  constructor(lenderId: string) {
    super(`lenders/${lenderId}/teams.json`, {}, 'teams')
  }
}
