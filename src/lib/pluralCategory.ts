// The plural category of a number in a language ("one", "other", ...), from the
// platform's CLDR rules: 1 is "one" in English, 0 and 1.5 are too in French, and
// Japanese and Chinese have only "other". Rules are cached per language.
const rules = new Map<string, Intl.PluralRules>()

export function pluralCategory(locale: string, value: number): string {
  let rule = rules.get(locale)
  if (!rule) {
    try {
      rule = new Intl.PluralRules(locale)
    } catch {
      rule = new Intl.PluralRules('en')
    }
    rules.set(locale, rule)
  }
  return rule.select(value)
}
