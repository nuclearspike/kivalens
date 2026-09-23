/**
 * The colours a chart gives to a set of things it has no colour for — slices of
 * a distribution, loans in a stack. Twenty, so a long list rarely repeats, and
 * each is dark enough to carry white text and light enough to read against the
 * dark surface.
 *
 * Series that MEAN something keep their own colour and do not come from here:
 * the monthly repayment bar is amber, the cumulative line is the app's green.
 */
export const SERIES_PALETTE = [
  '#4a8b5c', '#e8a838', '#5b8bd4', '#d45b5b', '#8b5bd4',
  '#d4a05b', '#5bd4a0', '#d45ba0', '#5bd4d4', '#a0d45b',
  '#7c5b2e', '#2e7c5b', '#5b2e7c', '#7c2e5b', '#2e5b7c',
  '#c47a3a', '#3ac47a', '#7a3ac4', '#c43a7a', '#3a7ac4',
]

/** The colour for the nth thing in a set, cycling once the palette runs out. */
export function seriesColor(index: number): string {
  return SERIES_PALETTE[index % SERIES_PALETTE.length]
}
