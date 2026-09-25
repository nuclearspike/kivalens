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

/** Addresses without their query or fragment. A stack frame's :line:col after the address is kept. */
export function withoutQuery(text: string): string {
  return text.replace(/[?#][^\s)]*?(?=(?::\d+){1,2}(?=[\s)]|$)|[\s)]|$)/g, '')
}

function sitePages(origin: string): RegExp | null {
  if (!origin) return null
  return new RegExp(`${origin.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}/(?!assets/)[^\\s):]*`, 'g')
}

/** A stack or source: queries stripped, the site's own pages named "[page]". */
export function scrubAddresses(text: string, origin: string): string {
  const pages = sitePages(origin)
  const bare = withoutQuery(text)
  return pages ? bare.replace(pages, '[page]') : bare
}

/** A message: as scrubAddresses, then other addresses cut to their origin and long numbers to "#". */
export function scrubMessage(text: string, origin: string): string {
  return scrubAddresses(text, origin)
    .replace(/\b(https?:\/\/[^/\s)'"]+)(?!\/assets\/)\/[^\s)'"]*/g, (_all, host: string) => `${host}/…`)
    .replace(/\d{4,}/g, '#')
}
