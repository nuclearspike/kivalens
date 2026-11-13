/**
 * What is taken out of a browser error before it is kept: applied by the page
 * (errors.ts) and again by the collector (cloudflare/rum/src/beacon.ts), so a
 * page from an older build cannot store what a newer one would have removed.
 *
 * `origin` is the site's own (https://www.kivalens.org). Code run on a page
 * rather than from a script file is reported against the page's address, which
 * can hold a loan or partner id, and an error can surface after the lender has
 * moved on, so every address on the site outside /assets/ becomes "[page]",
 * whichever page it was. Script files keep their address: that is where the bug
 * is. A message can quote a Kiva address with a lender id in it, or a response
 * body, so in a message every other address is cut to its origin and every run
 * of four or more digits (a loan or partner id) becomes "#".
 */

/**
 * Addresses without their query or fragment. A stack frame's :line:col after the address is kept.
 * Only an address loses a "?" or "#": elsewhere a "#" is the mark a scrub left for a number.
 */
export function withoutQuery(text: string): string {
  return text.replace(/(\b[a-z][\w+.-]*:\/\/[^\s?#)]*)[?#][^\s)]*?(?=(?::\d+){1,2}(?=[\s)]|$)|[\s)]|$)/gi, '$1')
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

function sitePages(origin: string): RegExp | null {
  if (!origin) return null
  return new RegExp(`${escapeRegExp(origin)}/(?!assets/)[^\\s):]*`, 'gi')
}

/** A stack or source: queries stripped, the site's own pages named "[page]". */
export function scrubAddresses(text: string, origin: string): string {
  const pages = sitePages(origin)
  const bare = withoutQuery(text)
  return pages ? bare.replace(pages, '[page]') : bare
}

// What locates code is kept as it is, held aside while the rest is scrubbed: this site's own
// script addresses with their line and column (a bundle's hashed name can hold four digits in a
// row), a line and column right after <anonymous>, eval, Function or [page], a line (and column)
// right after a script file's name, and Firefox's "line N >" before an eval. A page's frame
// always has both, so "[page]:9876543" is a number in an address, not a position. Another
// site's address is not held, its /assets/ path included: it is cut to its site, position too.
function codeLocations(origin: string): RegExp {
  const own = origin ? `${escapeRegExp(origin)}/assets/[^\\s)'"]*?(?::\\d+){0,2}(?=[\\s)'",]|$)|` : ''
  const code = `(?:<anonymous>|\\beval|\\bFunction|\\[page\\])(?::\\d+){2}(?!\\w)|\\.(?:[cm]?js|jsx|tsx?|html?)(?::\\d+){1,2}(?!\\w)|\\bline \\d+(?= > )`
  return new RegExp(own + code, 'gi')
}

/**
 * Error text, a message or a stack alike, with no need to tell a frame from message text (a
 * browser starts a stack with the error's own message): as scrubAddresses, then every address but
 * this site's own scripts cut to its site and every run of four or more digits made "#", except
 * where it locates code (codeLocations). Words that name nothing by address or number, a lender
 * id spelled as a word among them, are left as they are.
 */
export function scrubMessage(text: string, origin: string): string {
  const held: string[] = []
  return scrubAddresses(text, origin)
    .replace(codeLocations(origin), (code) => `\uE000${held.push(code) - 1}\uE000`)
    .replace(/\b(https?:\/\/[^/\s)'"]+)\/[^\s)'"]*/gi, (_all, host: string) => `${host}/…`)
    .replace(/\d{4,}/g, '#')
    .replace(/\uE000(\d+)\uE000/g, (_all, i: string) => held[Number(i)] ?? '')
}

/** A stack: scrubbed as error text, line by line, keeping each frame's script and position. */
export function scrubStack(text: string, origin: string): string {
  return text
    .split('\n')
    .map((line) => scrubMessage(line, origin))
    .join('\n')
}
