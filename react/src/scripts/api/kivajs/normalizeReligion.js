/**
 * Normalizes the free-text "Religious Affiliation" field from the Atheist Team's
 * Google Spreadsheet into a standardized set of categories for filtering.
 *
 * Works on both server (Node) and client (browser).
 *
 * Categories:
 *   "Secular"              - No religious affiliation
 *   "Christian"             - Explicitly Christian/Catholic organization
 *   "Christian Influence"   - Some Christian ties but not explicitly Christian
 *   "Muslim"                - Islamic affiliation or influence
 *   "Hindu"                 - Hindu affiliation or influence
 *   "Jewish"                - Jewish affiliation
 *   "Other"                 - Other religious or spiritual affiliation
 *   "Unknown"               - No data or unclassifiable
 *
 * @param {string} raw - The raw religiousAffiliation string from the spreadsheet
 * @returns {string[]} Array of normalized religion categories (usually one, but can be multiple)
 */
function normalizeReligion(raw) {
    if (!raw || raw.trim() === '') return ['Unknown']

    var s = raw.trim().toLowerCase()

    // Check each category with keyword matching
    var categories = []

    // Secular checks (most common)
    if (/\bsecular\b/.test(s) && !/\bnot secular\b/.test(s)) {
        categories.push('Secular')
    }

    // Christian checks
    if (/\bchristian\b/.test(s) || /\bcatholic\b/.test(s) || /\bprotestant\b/.test(s)
        || /\bevangelical\b/.test(s) || /\bchurch\b/.test(s) || /\bgospel\b/.test(s)
        || /\bbiblical\b/.test(s) || /\bmennonite\b/.test(s) || /\bquaker\b/.test(s)
        || /\bpresbyterian\b/.test(s) || /\bmethodist\b/.test(s) || /\bbaptist\b/.test(s)
        || /\blutheran\b/.test(s) || /\bjesus\b/.test(s) || /\bchrist\b/.test(s)) {
        // Distinguish between "Christian" and "Christian Influence"
        if (/\binfluences?\b/.test(s) || /\bsome\b/.test(s) || /\boriginally\b/.test(s)
            || /\bpossibly\b/.test(s) || /\bties\b/.test(s) || /\bhistory\b/.test(s)) {
            categories.push('Christian Influence')
        } else if (/\bpresumed\b/.test(s) || /\buncertain\b/.test(s) || /\bpresumably\b/.test(s)) {
            categories.push('Christian') // presumed is still categorized as Christian
        } else {
            categories.push('Christian')
        }
    }

    // Muslim checks
    if (/\bmuslim\b/.test(s) || /\bislam\b/.test(s) || /\bislamic\b/.test(s)
        || /\bsharia\b/.test(s) || /\bmosque\b/.test(s)) {
        if (/\binfluence\b/.test(s) || /\bpossibly\b/.test(s)) {
            categories.push('Muslim')
        } else {
            categories.push('Muslim')
        }
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
    if (/\bother\b/.test(s) || /\bdeistic\b/.test(s) || /\baymara\b/.test(s)
        || /\bspiritual\b/.test(s)) {
        categories.push('Other')
    }

    // If we found both Secular and something else (e.g. "Secular, possibly Muslim influence")
    // keep both — the filter can handle multiple categories
    if (categories.length === 0) {
        // Catch-all for things we couldn't classify
        if (/\bpresumed\b/.test(s)) {
            categories.push('Secular') // "Presumed secular" without explicit match
        } else {
            categories.push('Unknown')
        }
    }

    // Deduplicate
    return categories.filter((v, i, a) => a.indexOf(v) === i)
}

/**
 * All possible normalized religion categories
 */
var RELIGION_CATEGORIES = [
    'Secular', 'Christian', 'Christian Influence', 'Muslim',
    'Hindu', 'Jewish', 'Buddhist', 'Other', 'Unknown'
]

/**
 * Process a list of partners and add normalized religion data.
 * Call this after the atheist list has been merged into partners.
 *
 * @param {Object[]} partners - Array of partner objects with atheistScore.religiousAffiliation
 * @returns {Object[]} Same array, with each partner gaining a `normalizedReligions` array
 */
function processPartnerReligions(partners) {
    if (!partners) return []
    partners.forEach(function(partner) {
        var raw = ''
        if (partner.atheistScore && partner.atheistScore.religiousAffiliation) {
            raw = partner.atheistScore.religiousAffiliation
        }
        partner.normalizedReligions = normalizeReligion(raw)
    })
    return partners
}

/**
 * Build a summary of religion categories across all partners.
 * Useful for populating a filter dropdown with counts.
 *
 * @param {Object[]} partners - Array of partners (after processPartnerReligions)
 * @returns {Object} Map of category -> count
 */
function getReligionSummary(partners) {
    var summary = {}
    RELIGION_CATEGORIES.forEach(function(cat) { summary[cat] = 0 })
    partners.forEach(function(partner) {
        var religions = partner.normalizedReligions || normalizeReligion('')
        religions.forEach(function(r) {
            summary[r] = (summary[r] || 0) + 1
        })
    })
    return summary
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { normalizeReligion, RELIGION_CATEGORIES, processPartnerReligions, getReligionSummary }
} else {
    // Browser global
    window.normalizeReligion = normalizeReligion
    window.RELIGION_CATEGORIES = RELIGION_CATEGORIES
    window.processPartnerReligions = processPartnerReligions
    window.getReligionSummary = getReligionSummary
}
