/**
 * Normalizes the free-text "Religious Affiliation" field from the Atheist Team's
 * Google Spreadsheet into a standardized set of categories for filtering.
 */
export function normalizeReligion(raw: string): string[] {
  if (!raw || raw.trim() === '') return ['Unknown']

  const s = raw.trim().toLowerCase()
  const categories: string[] = []

  // Secular checks
  if (/\bsecular\b/.test(s) && !/\bnot secular\b/.test(s)) {
    categories.push('Secular')
  }

  // Christian checks
  if (
    /\bchristian\b/.test(s) || /\bcatholic\b/.test(s) ||
    /\bprotestant\b/.test(s) || /\bevangelical\b/.test(s) ||
    /\bchurch\b/.test(s) || /\bgospel\b/.test(s) ||
    /\bbiblical\b/.test(s) || /\bmennonite\b/.test(s) ||
    /\bquaker\b/.test(s) || /\bpresbyterian\b/.test(s) ||
    /\bmethodist\b/.test(s) || /\bbaptist\b/.test(s) ||
    /\blutheran\b/.test(s) || /\bjesus\b/.test(s) ||
    /\bchrist\b/.test(s)
  ) {
    if (
      /\binfluences?\b/.test(s) || /\bsome\b/.test(s) ||
      /\boriginally\b/.test(s) || /\bpossibly\b/.test(s) ||
      /\bties\b/.test(s) || /\bhistory\b/.test(s)
    ) {
      categories.push('Christian Influence')
    } else {
      categories.push('Christian')
    }
  }

  // Muslim checks
  if (
    /\bmuslim\b/.test(s) || /\bislam\b/.test(s) ||
    /\bislamic\b/.test(s) || /\bsharia\b/.test(s) ||
    /\bmosque\b/.test(s)
  ) {
    categories.push('Muslim')
  }

  // Hindu checks
  if (/\bhindu\b/.test(s) || /\bhinduism\b/.test(s) || /\bneo-hinduism\b/.test(s)) {
    categories.push('Hindu')
  }

  // Jewish checks
  if (/\bjewish\b/.test(s) || /\bjudaism\b/.test(s) || /\bjudaic\b/.test(s)) {
    categories.push('Jewish')
  }

  // Buddhist checks
  if (/\bbuddhist\b/.test(s) || /\bbuddhism\b/.test(s)) {
    categories.push('Buddhist')
  }

  // Other checks
  if (
    /\bother\b/.test(s) || /\bdeistic\b/.test(s) ||
    /\baymara\b/.test(s) || /\bspiritual\b/.test(s)
  ) {
    categories.push('Other')
  }

  if (categories.length === 0) {
    if (/\bpresumed\b/.test(s)) {
      categories.push('Secular')
    } else {
      categories.push('Unknown')
    }
  }

  // Deduplicate
  return [...new Set(categories)]
}

export const RELIGION_CATEGORIES = [
  'Secular',
  'Christian',
  'Christian Influence',
  'Muslim',
  'Hindu',
  'Jewish',
  'Buddhist',
  'Other',
  'Unknown',
]

/**
 * Process a list of partners and add normalized religion data.
 * Call this after the atheist list has been merged into partners.
 */
export function processPartnerReligions(partners: any[]): any[] {
  if (!partners) return []
  partners.forEach((partner) => {
    const raw =
      partner.atheistScore?.religiousAffiliation || ''
    partner.normalizedReligions = normalizeReligion(raw)
  })
  return partners
}

/**
 * Build a summary of religion categories across all partners.
 */
export function getReligionSummary(
  partners: any[]
): Record<string, number> {
  const summary: Record<string, number> = {}
  RELIGION_CATEGORIES.forEach((cat) => {
    summary[cat] = 0
  })
  partners.forEach((partner) => {
    const religions = partner.normalizedReligions || normalizeReligion('')
    religions.forEach((r: string) => {
      summary[r] = (summary[r] || 0) + 1
    })
  })
  return summary
}
