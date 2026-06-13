import { SemRequest } from './SemRequest'
import { ResultProcessors } from './ResultProcessors'
import { postUrl, getUrl } from './kivaBase'

const kivaBase = `${location.protocol}//${location.host}/proxy/kiva/`
const gdocs = `${location.protocol}//${location.host}/proxy/gdocs/`
const gdocsDirect = 'https://docs.google.com/'

const klSemRequest = new SemRequest(
  `${location.protocol}//${location.host}/api/`,
  true,
  false,
  {},
  0
)

export const req = {
  kl: Object.assign(klSemRequest, {
    graph: async (query: string): Promise<any> => {
      const response = await postUrl(
        `${location.protocol}//${location.host}/graphql`,
        query
      )
      return response.data
    },
  }),

  klraw: new SemRequest(
    `${location.protocol}//${location.host}/`,
    false,
    false,
    {},
    0
  ),

  kiva: {
    api: Object.assign(
      new SemRequest(
        'https://api.kivaws.org/v1/',
        true,
        false,
        { app_id: 'org.kiva.kivalens' },
        2
      ),
      {
        loans: async (ids: number[], process = true): Promise<any[]> => {
          const res = await req.kiva.api.get(`loans/${ids.join(',')}.json`)
          const loans = res.loans
          return process ? ResultProcessors.processLoans(loans) : loans
        },

        loan: async (id: number): Promise<any> => {
          const res = await req.kiva.api.get(`loans/${id}.json`)
          return ResultProcessors.processLoan(res.loans[0])
        },

        similarTo: async (id: number): Promise<any[]> => {
          const res = await req.kiva.api.get(`loans/${id}/similar.json`)
          return res.loans
        },

        lender: async (lenderId: string): Promise<any> => {
          const res = await req.kiva.api.get(`lenders/${lenderId}.json`)
          return res.lenders[0]
        },

        lenders: async (lenders: string[]): Promise<any[]> => {
          const res = await req.kiva.api.get(
            `lenders/${lenders.join(',')}.json`
          )
          return res.lenders
        },
      }
    ),

    page: new SemRequest(kivaBase, false, true, {}, 5 * 60),
    ajax: new SemRequest(`${kivaBase}ajax/`, true, true, {}, 5 * 60),
  },

  gdocs: {
    atheist: {
      async get(): Promise<string> {
        const path = 'spreadsheets/d/1KP7ULBAyavnohP4h8n2J2yaXNpIRnyIXdjJj_AwtwK0/export?gid=1&format=csv'
        try {
          return await getUrl(`${gdocs}${path}`, {
            parseJSON: false,
            includeRequestedWith: true,
          })
        } catch {
          return getUrl(`${gdocsDirect}${path}`, { parseJSON: false })
        }
      },
    },
  },
}
