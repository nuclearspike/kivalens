/**
 * aplus.mjs — the A+ (Atheist Team) data: CSV parsing + religion normalization,
 * shared by the client (src/api/kiva.ts, normalizeReligion.ts) and the prod
 * server (klCore, for RSS partner-criteria parity) so both compute identical
 * atheistScore + normalizedReligions from the same spreadsheet. Plain JS.
 */

// ---- CSV parsing (ported from kiva.ts) ------------------------------------
export function csvToArray(strData) {
  const delimiter = ','
  const pattern = new RegExp(
    '(\\' + delimiter + '|\\r?\\n|\\r|^)' +
      '(?:"([^"]*(?:""[^"]*)*)"|' +
      '([^"\\' + delimiter + '\\r\\n]*))',
    'gi',
  )
  const arrData = [[]]
  let matches
  while ((matches = pattern.exec(strData))) {
    const matchedDelimiter = matches[1]
    if (matchedDelimiter.length && matchedDelimiter !== delimiter) {
      arrData.push([])
    }
    const value = matches[2] ? matches[2].replace(/""/g, '"') : matches[3]
    arrData[arrData.length - 1].push(value)
  }
  return arrData
}

export function csvToPartnerScores(csv) {
  const arr = csvToArray(csv)
  if (arr.length >= 1) {
    arr[0] = [
      'id', 'X', 'Name', 'Link', 'Country', 'Kiva Status', 'Default Rate',
      'Loans at Risk', 'Kiva Risk Rating (5 best)', 'secularRating',
      'religiousAffiliation', 'commentsOnSecularRating', 'socialRating',
      'commentsOnSocialRating', 'MFI Link', 'By', 'Date', 'reviewComments',
      'P', 'J', 'MFI Name', 'index', 'MFI Name Check',
    ]
  }
  const result = []
  for (let i = 1; i < arr.length; i++) {
    const obj = {}
    for (let k = 0; k < arr[0].length && k < arr[i].length; k++) {
      obj[arr[0][k]] = arr[i][k]
    }
    result.push(obj)
  }
  return result
}

// ---- Religion normalization (ported from normalizeReligion.ts) ------------
export function normalizeReligion(raw) {
  if (!raw || raw.trim() === '') return ['Unknown']

  const s = raw.trim().toLowerCase()
  const categories = []

  if (/\bsecular\b/.test(s) && !/\bnot secular\b/.test(s)) {
    categories.push('Secular')
  }

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

  if (
    /\bmuslim\b/.test(s) || /\bislam\b/.test(s) ||
    /\bislamic\b/.test(s) || /\bsharia\b/.test(s) ||
    /\bmosque\b/.test(s)
  ) {
    categories.push('Muslim')
  }

  if (/\bhindu\b/.test(s) || /\bhinduism\b/.test(s) || /\bneo-hinduism\b/.test(s)) {
    categories.push('Hindu')
  }

  if (/\bjewish\b/.test(s) || /\bjudaism\b/.test(s) || /\bjudaic\b/.test(s)) {
    categories.push('Jewish')
  }

  if (/\bbuddhist\b/.test(s) || /\bbuddhism\b/.test(s)) {
    categories.push('Buddhist')
  }

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

export function processPartnerReligions(partners) {
  if (!partners) return []
  partners.forEach((partner) => {
    const raw = partner.atheistScore?.religiousAffiliation || ''
    partner.normalizedReligions = normalizeReligion(raw)
  })
  return partners
}

export function getReligionSummary(partners) {
  const summary = {}
  RELIGION_CATEGORIES.forEach((cat) => {
    summary[cat] = 0
  })
  partners.forEach((partner) => {
    const religions = partner.normalizedReligions || normalizeReligion('')
    religions.forEach((r) => {
      summary[r] = (summary[r] || 0) + 1
    })
  })
  return summary
}

// ---- Merge A+ scores into partner objects, then normalize religions -------
// Mutates the partner objects in place. `csv` may be null/empty (then only the
// religion normalization runs, yielding ['Unknown'] for everyone). Returns the
// number of partners that matched an A+ row.
export function applyAtheistData(partners, csv) {
  if (!partners) return 0
  let merged = 0
  if (csv) {
    const byId = new Map()
    for (const p of partners) byId.set(parseInt(p.id, 10), p)
    for (const mfi of csvToPartnerScores(csv)) {
      const p = byId.get(parseInt(mfi.id, 10))
      if (p) {
        p.atheistScore = {
          secularRating: parseInt(mfi.secularRating, 10),
          religiousAffiliation: mfi.religiousAffiliation,
          commentsOnSecularRating: mfi.commentsOnSecularRating,
          socialRating: parseInt(mfi.socialRating, 10),
          commentsOnSocialRating: mfi.commentsOnSocialRating,
          reviewComments: mfi.reviewComments,
        }
        merged++
      }
    }
  }
  processPartnerReligions(partners)
  return merged
}
