import { Container } from '../ui'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'

// Privacy policy. KivaLens is an independent tool (not Kiva); it has no accounts
// of its own. The notable data flow is the "Ask KivaLens" assistant, whose
// conversations are logged for analytics/debugging/improvement.
export default function Privacy() {
  const { t, date } = useI18n()
  return (
    <Container className="py-3" style={{ maxWidth: 820 }}>
      <h1>{t('KivaLens Privacy Policy')}</h1>
      <p className="text-muted">{t('Last updated: {date}', { date: date('2026-06-22T12:00:00Z', { dateStyle: 'long' }) })}</p>

      <h3>{t('About KivaLens')}</h3>
      <p>
        {t('KivaLens is a free, independent tool for searching and filtering fundraising loans on Kiva.org. It is not operated by, affiliated with, or endorsed by Kiva Microfunds. KivaLens has no user accounts of its own — you interact with your Kiva account directly on kiva.org.')}
      </p>

      <h3>{t('The short version')}</h3>
      <ul>
        <li>
           {t('Your preferences — search criteria, saved searches, basket, options, and Kiva Lender ID — are stored in your own browser and mostly never leave your device.')}
        </li>
        <li>
           {t('If you use the Ask KivaLens AI assistant, your messages are sent to our server and OpenAI and logged so we can analyze usage, debug, control cost, and improve the assistant.')}
        </li>
        <li>{t('We do not sell your data and we do not use advertising or cross-site tracking.')}</li>
      </ul>

      <h3>{t('Information we handle')}</h3>
      <h4>{t('Stored in your browser')}</h4>
      <p>
        {t('Your search criteria, saved searches, basket, display options, and Kiva Lender ID are stored in browser storage. They stay on your device and are not sent to KivaLens servers except as described below. Clearing browser storage removes them.')}
      </p>

      <h4>{t('Your Kiva Lender ID (optional)')}</h4>
      <p>
        {t('If you provide your Kiva Lender ID, KivaLens reads your public Kiva profile and lending history to hide loans you already funded, balance your portfolio, power portfolio-aware RSS feeds, and improve assistant suggestions. We only access public Kiva data and never have your Kiva password or login.')}
      </p>

      <h4>{t('Ask KivaLens AI assistant conversations')}</h4>
      <p>
        {t('When you chat with the assistant, your messages and context such as the current page, search criteria, basket, and Lender ID are sent to our server, which forwards them to OpenAI to generate replies.')}
      </p>
      <p>
        {t('We log these conversations — messages, assistant responses, tools used, and token/cost metadata — to understand usage, troubleshoot, control cost and abuse, and improve helpfulness and accuracy. Logs use a random per-browser identifier and your Lender ID if set, and may be reviewed by the operator.')}
      </p>
      <p>
        {t('Do not put sensitive personal information such as passwords, financial account numbers, or government IDs into the chat. KivaLens does not need it. OpenAI processes messages under its own terms and privacy policy; we do not control OpenAI’s practices.')}
      </p>

      <h4>{t('Anonymous diagnostics')}</h4>
      <p>
        {t('KivaLens may send occasional anonymous heartbeat pings containing a random install identifier and uptime to keep loan data fresh and gauge active usage. These do not identify you.')}
      </p>

      <h4>{t('Loans, partners, and lending')}</h4>
      <p>
        {t('Loan, borrower, and field-partner information comes from Kiva’s public API and the public A+ Team research spreadsheet. When you transfer a basket, KivaLens sends selected loan IDs to kiva.org, where you complete checkout. KivaLens does not process payments or see payment details.')}
      </p>

      <h3>{t('Third parties')}</h3>
      <ul>
        <li>
           {t('Kiva (kiva.org, api.kivaws.org) — loan, partner, lender data, and basket checkout.')}
        </li>
        <li>
           {t('OpenAI — powers the AI assistant and receives chat messages and context.')}
        </li>
        <li>
           {t('Google Docs — hosts the public A+ Team research sheet we read.')}
        </li>
        <li>
           {t('Hosting and infrastructure providers and a managed datastore where AI conversation logs and operational data are kept.')}
        </li>
      </ul>
      <p>{t('Each third party has its own privacy practices.')}</p>

      <h3>{t('Cookies & tracking')}</h3>
      <p>
        {t('KivaLens does not use advertising or cross-site tracking cookies. It uses browser storage for preferences and a random identifier for AI-chat logging, as described above.')}
      </p>

      <h3>{t('Data retention')}</h3>
      <p>
        {t('Browser-stored data persists until you clear it. AI conversation logs are retained for the purposes above and periodically rotated or expired; we keep them only as long as useful.')}
      </p>

      <h3>{t('Your choices')}</h3>
      <p>
        {t('You can use most of KivaLens without a Lender ID or the assistant. You can turn the assistant off in')}{' '}
        <Link to="/options">{t('Options')}</Link>.{' '}
        {t('Clearing browser storage removes local data. To ask about or request deletion of AI logs, contact us; logs keyed only by a random browser identifier can be difficult to locate without it.')}
      </p>

      <h3>{t('Children')}</h3>
      <p>
        {t('KivaLens is not directed to children under 13 or the minimum age in your jurisdiction, and we do not knowingly collect their information.')}
      </p>

      <h3>{t('Changes')}</h3>
      <p>{t('We may update this policy; the Last updated date above reflects the latest version.')}</p>

      <h3>{t('Contact')}</h3>
      <p>
        {t('Questions about privacy? See')} <Link to="/about">{t('About')}</Link> {t('for contact information.')}
      </p>
    </Container>
  )
}
