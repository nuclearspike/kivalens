/**
 * Religion normalization now lives in the shared A+ module (server/aplus.mjs) so
 * the client and the prod RSS server compute identical normalizedReligions from
 * the same spreadsheet. Re-exported here to keep the import path + test stable.
 */
export {
  normalizeReligion,
  RELIGION_CATEGORIES,
  processPartnerReligions,
  getReligionSummary,
} from '../../../server/aplus.mjs'
