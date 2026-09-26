import { envelope, send, type ClientFacts, type Outcome, type Signer, type Transport } from './protocol'
import type { ContactState, OutcomeCode, ReportKind, StoredReport, SupportStore } from './storage'

/**
 * The three things the page asks the service: send a report, check a report's
 * status, and change the reply email on one report. Each takes the lender's
 * explicit action; opening My Reports, expanding a row or changing language
 * makes no request and never touches the key (definition myReports
 * contactManagement.passiveInspection).
 */

export interface SupportDeps {
  store: SupportStore
  transport: Transport
  facts: () => ClientFacts
}

type Failure = Extract<Outcome<never>, { ok: false }>

let enrolling: Promise<Signer | Failure> | null = null

/**
 * This browser's installation, enrolled on first use and kept in the store.
 *
 * `staleKeyId` is a key the service just refused. It is replaced only if it is
 * still the stored one: several requests refused together (a status check of
 * every report) share one new enrollment instead of racing to make one each.
 */
export async function installation(deps: SupportDeps, staleKeyId?: string): Promise<Signer | Failure> {
  const current = await deps.store.getInstallation().catch(() => undefined)
  if (current && current.keyId !== staleKeyId) return { keyId: current.keyId, privateKey: current.keyPair.privateKey }
  // No clearing first: the new enrollment overwrites the stored key, and if it
  // fails the old one stays to be refused and replaced next time.
  enrolling ??= (async () => {
    // Non-extractable: the private key can sign in this browser and never leave it.
    const keyPair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, [
      'sign',
      'verify',
    ])) as CryptoKeyPair
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
    const enrolled = await send<{ keyId: string }>(deps.transport, '/v1/installations/enroll', (now) =>
      envelope('installation.enroll', deps.facts(), { publicKeyJwk: { kty: 'EC', crv: 'P-256', x: publicKeyJwk.x, y: publicKeyJwk.y, key_ops: ['verify'] } }, now),
    )
    if (!enrolled.ok) return enrolled
    await deps.store.setInstallation({ keyId: enrolled.payload.keyId, keyPair }).catch(() => undefined)
    return { keyId: enrolled.payload.keyId, privateKey: keyPair.privateKey }
  })()
  const pending = enrolling
  try {
    return await pending
  } finally {
    if (enrolling === pending) enrolling = null
  }
}

const isSigner = (value: Signer | Failure): value is Signer => 'keyId' in value

/**
 * A signed request, enrolling first when needed. A key the service no longer
 * knows (a reset service, a revoked install) is replaced once and the request
 * repeated: a report's status is authorized by its receipt, not by the key.
 */
async function signed<T>(deps: SupportDeps, path: string, messageType: string, payload: object): Promise<Outcome<T>> {
  let stale: string | undefined
  for (let attempt = 0; attempt < 2; attempt++) {
    const signer = await installation(deps, stale)
    if (!isSigner(signer)) return signer
    const outcome = await send<T>(deps.transport, path, (now) => envelope(messageType, deps.facts(), payload, now), signer)
    if (!outcome.ok && outcome.kind === 'service' && outcome.error.code === 'unknownOrRevokedInstallation' && attempt === 0) {
      stale = signer.keyId
      continue
    }
    return outcome
  }
  return { ok: false, kind: 'transport' }
}

export interface FeedbackInput {
  kind: ReportKind
  message: string
  systemLanguage?: string
  email?: string
}

export interface FeedbackAccepted {
  report: StoredReport
  contactVerificationPending: boolean
}

export async function submitFeedback(deps: SupportDeps, input: FeedbackInput): Promise<Outcome<FeedbackAccepted>> {
  const payload = {
    kind: input.kind,
    message: input.message,
    ...(input.systemLanguage ? { systemLanguage: input.systemLanguage } : {}),
    ...(input.email
      ? { contact: { email: input.email, communicationConsent: true, automatedProcessingDisclosureAccepted: true } }
      : {}),
    // The lender has been shown what is sent (Show details) and the processing notice.
    disclosureReviewed: true,
  }
  const outcome = await signed<{ reportCode: string; receipt: string; contactVerificationPending: boolean }>(
    deps,
    '/v1/feedback',
    'feedback.submit',
    payload,
  )
  if (!outcome.ok) return outcome
  const report: StoredReport = {
    appId: deps.facts().appId,
    reportCode: outcome.payload.reportCode,
    receipt: outcome.payload.receipt,
    kind: input.kind,
    message: input.message,
    createdAt: outcome.serverTime || new Date().toISOString(),
    outcome: 'received',
    // Only what the service said: pending verification, or no address at all.
    // An address it did not confirm as pending stays unknown until a status check.
    contact: !input.email
      ? { state: 'none' }
      : outcome.payload.contactVerificationPending
        ? { state: 'pending', pendingEmail: input.email }
        : undefined,
  }
  // Accepted once the service says so. A store that cannot write keeps the
  // report for the page's life instead (storage.ts), never a second submission.
  await deps.store.putReport(report)
  return { ok: true, payload: { report, contactVerificationPending: outcome.payload.contactVerificationPending }, serverTime: outcome.serverTime }
}

interface StatusPayload {
  status: string
  revision: number
  updatedAt: string
  submittedMessage?: string
  contact?: ContactState
  outcome?: { code: OutcomeCode; fixedRelease?: { version: string } }
}

const OUTCOMES: ReadonlySet<string> = new Set([
  'received',
  'beingLookedAt',
  'needsInformation',
  'waitingForReply',
  'fixPrepared',
  'fixedIn',
  'availableIn',
  'cantReproduce',
  'completed',
  'relatedReport',
  'unavailable',
])

/**
 * One report's status. The outcome is the service's typed fact; anything
 * missing or unknown is `unavailable`, never inferred from the raw workflow
 * status (definition myReports.statusMapping).
 */
export async function checkStatus(deps: SupportDeps, report: StoredReport): Promise<Outcome<StoredReport>> {
  const outcome = await signed<StatusPayload>(deps, '/v1/reports/status', 'report.status', {
    reportCode: report.reportCode,
    receipt: report.receipt,
  })
  if (!outcome.ok) return outcome
  const code = outcome.payload.outcome?.code
  const known = code && OUTCOMES.has(code) ? code : 'unavailable'
  const version = outcome.payload.outcome?.fixedRelease?.version
  const next: StoredReport = {
    ...report,
    outcome: (known === 'fixedIn' || known === 'availableIn') && !version ? 'unavailable' : known,
    fixedVersion: version,
    contact: outcome.payload.contact ?? report.contact,
    revision: outcome.payload.revision,
    checkedAt: outcome.serverTime || new Date().toISOString(),
    // The original survives; the service's copy only fills a report that lost it.
    message: report.message || outcome.payload.submittedMessage || '',
  }
  await deps.store.putReport(next)
  return { ok: true, payload: next, serverTime: outcome.serverTime }
}

/** Set, remove or undo the reply email on this one report. */
export async function updateContact(
  deps: SupportDeps,
  report: StoredReport,
  action: 'set' | 'remove' | 'undo',
  email?: string,
): Promise<Outcome<StoredReport>> {
  const outcome = await signed<{ revision: number; contact: ContactState }>(deps, '/v1/reports/contact', 'report.contact.update', {
    reportCode: report.reportCode,
    receipt: report.receipt,
    ...(report.revision ? { expectedRevision: report.revision } : {}),
    action,
    ...(action === 'set' && email
      ? { contact: { email, communicationConsent: true, automatedProcessingDisclosureAccepted: true } }
      : {}),
  })
  if (!outcome.ok) return outcome
  const next: StoredReport = { ...report, contact: outcome.payload.contact, revision: outcome.payload.revision }
  await deps.store.putReport(next)
  return { ok: true, payload: next, serverTime: outcome.serverTime }
}
