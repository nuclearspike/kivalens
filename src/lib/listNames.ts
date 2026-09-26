/** "Te Creemos, Kenya, and Peru", in the lender's language (Intl.ListFormat). */
export function listNames(locale: string, names: string[]): string {
  try {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names)
  } catch {
    return names.join(', ')
  }
}
