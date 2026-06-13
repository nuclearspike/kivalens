import { useState, useMemo, useEffect } from 'react'
import { Container, Alert, Button, Form } from '../ui'
import { showAlert } from '../lib/dialog'
import { useCriteriaStore } from '../stores'
import { getKivaLoans, defaultKivaData } from '../api/kiva'

function KivaLink({ path, children }: { path: string; children: React.ReactNode }) {
  return (
    <a href={`https://www.kiva.org/${path}`} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

export function Component() {
  const lastCriteria = useCriteriaStore((s) => s.getLastCriteria)
  const criteria = useCriteriaStore((s) => s.lastKnown)

  const [includePartners, setIncludePartners] = useState(true)
  const [includeSectors, setIncludeSectors] = useState(true)
  const [includeCountries, setIncludeCountries] = useState(true)

  const totalSectors = defaultKivaData.sectors.length
  const totalCountries = defaultKivaData.countries.length

  const { partnerIds, sectors, countries, totalPartners } = useMemo(() => {
    const kl = getKivaLoans()
    if (!kl || !kl.isReady()) {
      return { partnerIds: [] as number[], sectors: [] as string[], countries: [] as string[], totalPartners: 0 }
    }
    const crit = lastCriteria()
    return {
      partnerIds: kl.getListOfPartners(crit),
      sectors: kl.getListOfSectors(crit),
      countries: kl.getListOfCountries(crit),
      totalPartners: kl.activePartners.length,
    }
  }, [lastCriteria, criteria])

  // Auto-adjust checkboxes based on whether filtering is meaningful
  useEffect(() => {
    setIncludePartners(partnerIds.length !== totalPartners)
    setIncludeSectors(sectors.length !== totalSectors)
    setIncludeCountries(countries.length !== totalCountries)
  }, [partnerIds.length, totalPartners, sectors.length, totalSectors, countries.length, totalCountries])

  const problems: string[] = []

  const isChrome = typeof window !== 'undefined' && /Chrome/.test(navigator.userAgent)
  if (!isChrome) {
    problems.push(
      'You are not using Google Chrome Browser. The Kiva Lender Assistant extension is required to push settings to Kiva, and it only works in Chrome.',
    )
  }

  const allBroad =
    partnerIds.length === totalPartners &&
    sectors.length === totalSectors &&
    countries.length === totalCountries
  if (allBroad) {
    problems.push(
      'Your criteria is so broad that there is nothing to set. Try narrowing your search criteria first.',
    )
  }

  const noneChecked = !includePartners && !includeSectors && !includeCountries

  const handlePush = () => {
    if (noneChecked) {
      void showAlert('Please check at least one box (Partners, Sectors, or Countries) to continue.')
      return
    }
    const payload: {
      partners?: number[]
      sectors?: string[]
      countries?: string[]
    } = {}
    if (includePartners) payload.partners = partnerIds
    if (includeSectors) payload.sectors = sectors
    if (includeCountries) payload.countries = countries

    // Attempt to send via the KLA Chrome extension
    try {
      const KLA_Extension = 'ehmkalmhgpadjmfcfekgdagfnmhakgna'
      const chromeGlobal = (window as unknown as Record<string, unknown>).chrome as
        | { runtime?: { sendMessage?: (id: string, msg: unknown, cb: (r: unknown) => void) => void } }
        | undefined
      if (chromeGlobal?.runtime?.sendMessage) {
        chromeGlobal.runtime.sendMessage(KLA_Extension, { setAutoLendPCS: payload }, (reply: unknown) =>
          console.log('KLA reply:', reply),
        )
      } else {
        void showAlert(
          'Chrome extension messaging is not available. Please install the Kiva Lender Assistant extension.',
        )
      }
    } catch {
      void showAlert(
        'Could not communicate with the Kiva Lender Assistant extension. Make sure it is installed and enabled.',
      )
    }
  }

  return (
    <Container className="py-3" style={{ maxWidth: 800 }}>
      <h3>Push your Auto-Lending preferences to Kiva</h3>

      <p>
        Kiva has had{' '}
        <KivaLink path="settings/credit">Auto-Lending</KivaLink> on its site for years.
        Auto-Lending is a feature where Kiva automatically lends your money based on rules you
        set up. If you always want to select your loans yourself, you can ignore this page.
      </p>

      <p>
        Use this page to automatically set your preferences for Sectors, Countries, and Partners
        on Kiva based on your current KivaLens search criteria.
      </p>

      <p>
        As your portfolio changes and partner stats shift over time, come back and perform this
        function again on a regular basis. It is recommended that you create a Saved Search
        specifically for your Auto-Lending preferences.
      </p>

      <p>
        Before using this feature, make sure{' '}
        <KivaLink path="settings/credit">Auto-Lending</KivaLink> is enabled on Kiva.
      </p>

      <hr />

      <p>By continuing, KivaLens will instruct the Kiva Lender Assistant to:</p>
      <ul className="list-unstyled ms-3">
        <li className="mb-1">
          Open a new tab to your Kiva Auto-Lending settings (you may need to log in).
        </li>
        <li className="mb-1">
          Check that Auto-Lending is turned on, and abort if it is not.
        </li>
        <li className="mb-2">
          <Form.Check
            type="checkbox"
            checked={includePartners}
            onChange={(e) => setIncludePartners(e.target.checked)}
            label={
              <span>
                Set the <b>{partnerIds.length}/{totalPartners} partners</b> that match the
                current criteria.
              </span>
            }
          />
        </li>
        <li className="mb-2">
          <Form.Check
            type="checkbox"
            checked={includeSectors}
            onChange={(e) => setIncludeSectors(e.target.checked)}
            label={
              <span>
                Set the <b>{sectors.length}/{totalSectors} sectors</b> that match the current
                criteria.
              </span>
            }
          />
        </li>
        <li className="mb-2">
          <Form.Check
            type="checkbox"
            checked={includeCountries}
            onChange={(e) => setIncludeCountries(e.target.checked)}
            label={
              <span>
                Set the <b>{countries.length}/{totalCountries} countries</b> that match the
                current criteria.
              </span>
            }
          />
        </li>
        <li>Save your new settings.</li>
      </ul>

      {problems.length > 0 && (
        <Alert variant="danger">
          There are problems preventing you from continuing:
          <ul className="mb-0 mt-1">
            {problems.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </Alert>
      )}

      <Button
        variant="primary"
        onClick={handlePush}
        disabled={problems.length > 0 || noneChecked}
      >
        Set Auto-Lending Options on Kiva
      </Button>
    </Container>
  )
}
