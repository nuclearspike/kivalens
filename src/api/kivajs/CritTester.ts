// CritTester now lives in the shared filter engine (server/loanFilter.mjs) so the
// client and the prod RSS server share ONE implementation and can't drift apart.
// Re-exported here to keep the existing import path and its test stable.
export { CritTester } from '../../../server/loanFilter.mjs'
