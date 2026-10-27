// Whether an npm version is the one package.json's engines.npm pins. Heroku builds with that npm, so the
// release gate (scripts/gate.mjs) runs its npm ci only on a matching one: npm majors disagree about which
// lockfiles are valid, and a lockfile the gate's npm accepts can still be refused by Heroku's.
//
// It reads the forms a pin takes here: a major ("11", "11.x", "11.x.x"), a minor ("11.6", "11.6.x") or an
// exact version ("11.6.2"). It does not read ranges such as ">=11" or "^11": those let Heroku pick a
// different npm from the gate's, which is what the pin is for.
const PIN = /^(\d+)(?:\.x(?:\.x)?|\.(\d+)(?:\.x|\.(\d+))?)?$/

export function checkNpm(pin, version) {
  if (!pin) {
    return { ok: false, detail: 'package.json sets no engines.npm, so Heroku builds with its own default npm, which the gate cannot match' }
  }
  const want = PIN.exec(String(pin).trim())
  if (!want) return { ok: false, detail: `engines.npm "${pin}" is not a pin the gate reads (11.x, 11.6.x or 11.6.2)` }
  const have = /^(\d+)\.(\d+)\.(\d+)/.exec(String(version ?? '').trim())
  if (!have) return { ok: false, detail: `could not read an npm version from "${String(version ?? '').trim()}"` }
  for (let i = 1; i <= 3; i++) {
    if (want[i] !== undefined && Number(want[i]) !== Number(have[i])) {
      return { ok: false, detail: `npm ${have[0]}, but Heroku builds with npm ${pin} (engines.npm)` }
    }
  }
  return { ok: true, detail: `npm ${have[0]}, as Heroku builds with (engines.npm ${pin})` }
}
