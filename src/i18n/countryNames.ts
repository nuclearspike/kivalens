// Country names the catalog does not carry. The catalog holds the countries
// Kiva is fundraising in today; a lender's past loans, and Kiva tomorrow, reach
// others (Bulgaria, Fiji, Kazakhstan…). Those are translated from the platform's
// own CLDR data: the English name is matched to its ISO 3166 code, and the code
// is named in the lender's language by Intl.DisplayNames. A name that matches no
// country returns undefined, so the caller shows it as Kiva sent it.

// Kiva's spellings that differ from CLDR's English names.
const KIVA_ALIASES: Record<string, string> = {
  'Congo (DRC)': 'CD',
  'The Democratic Republic of the Congo': 'CD',
  'Congo (Rep.)': 'CG',
  'Congo': 'CG',
  "Cote D'Ivoire": 'CI',
  "Côte d'Ivoire": 'CI',
  'Ivory Coast': 'CI',
  "Lao People's Democratic Republic": 'LA',
  'Lao PDR': 'LA',
  'Myanmar (Burma)': 'MM',
  'Myanmar': 'MM',
  'Burma': 'MM',
  'Palestine': 'PS',
  'Timor-Leste': 'TL',
  'East Timor': 'TL',
  'Moldova, Republic of': 'MD',
  'Tanzania, United Republic of': 'TZ',
  'Viet Nam': 'VN',
  'Kyrgyz Republic': 'KG',
  'Saint Vincent and the Grenadines': 'VC',
  'St Vincent': 'VC',
  'Turkiye': 'TR',
  'Türkiye': 'TR',
  'Eswatini': 'SZ',
  'Swaziland': 'SZ',
  'Cape Verde': 'CV',
  'Cabo Verde': 'CV',
  'Bosnia and Herzegovina': 'BA',
  'Virgin Islands': 'VI',
  'Puerto Rico': 'PR',
}

const normalize = (name: string) => name.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’`]/g, "'").replace(/&/g, 'and').replace(/\s+/g, ' ').trim().toLowerCase()

let codeByEnglishName: Map<string, string> | null = null

function englishNameIndex(): Map<string, string> {
  if (codeByEnglishName) return codeByEnglishName
  const index = new Map<string, string>()
  try {
    const english = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    for (const a of A) {
      for (const b of A) {
        const name = english.of(a + b)
        if (name) index.set(normalize(name), a + b)
      }
    }
  } catch {
    // No Intl.DisplayNames: only the aliases resolve; everything else passes through.
  }
  for (const [name, code] of Object.entries(KIVA_ALIASES)) index.set(normalize(name), code)
  codeByEnglishName = index
  return index
}

const displayNames = new Map<string, Intl.DisplayNames | null>()

export function localizeCountryName(locale: string, englishName: string): string | undefined {
  const code = englishNameIndex().get(normalize(englishName))
  if (!code) return undefined
  if (!displayNames.has(locale)) {
    try {
      displayNames.set(locale, new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' }))
    } catch {
      displayNames.set(locale, null)
    }
  }
  return displayNames.get(locale)?.of(code) ?? undefined
}
