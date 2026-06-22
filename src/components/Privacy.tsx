import { Container } from '../ui'
import { Link } from 'react-router-dom'

// Privacy policy. KivaLens is an independent tool (not Kiva); it has no accounts
// of its own. The notable data flow is the "Ask KivaLens" assistant, whose
// conversations are logged for analytics/debugging/improvement.
export default function Privacy() {
  return (
    <Container className="py-3" style={{ maxWidth: 820 }}>
      <h1>KivaLens Privacy Policy</h1>
      <p className="text-muted">Last updated: June 22, 2026</p>

      <h3>About KivaLens</h3>
      <p>
        KivaLens is a free, independent tool for searching and filtering fundraising loans on
        Kiva.org. It is <strong>not operated by, affiliated with, or endorsed by Kiva Microfunds</strong>.
        KivaLens has no user accounts of its own — you interact with your Kiva account directly on
        kiva.org.
      </p>

      <h3>The short version</h3>
      <ul>
        <li>
          Your preferences — search criteria, saved searches, basket, options, and your Kiva Lender
          ID — are stored in <strong>your own browser</strong> and mostly never leave your device.
        </li>
        <li>
          If you use the <strong>“Ask KivaLens” AI assistant</strong>, your messages are sent to our
          server and to OpenAI, and are <strong>logged so we can analyze usage, debug, control cost,
          and improve the assistant</strong>.
        </li>
        <li>We do not sell your data and we do not use advertising or cross-site tracking.</li>
      </ul>

      <h3>Information we handle</h3>
      <h4>Stored in your browser</h4>
      <p>
        Your search criteria, saved searches, basket, display options, and your Kiva Lender ID (if you
        set it) are stored locally via your browser&apos;s storage. This stays on your device and is
        not sent to KivaLens servers except as described below. Clearing your browser storage removes
        it.
      </p>

      <h4>Your Kiva Lender ID (optional)</h4>
      <p>
        If you provide your Kiva Lender ID, KivaLens uses it to read your <em>public</em> Kiva profile
        and lending history from Kiva&apos;s public API/site so it can hide loans you&apos;ve already
        funded, balance your portfolio, power portfolio-aware RSS feeds, and let the assistant make
        portfolio-aware suggestions. We access only publicly available Kiva data for that ID. We never
        have your Kiva password or login.
      </p>

      <h4>“Ask KivaLens” AI assistant conversations</h4>
      <p>
        When you chat with the assistant, your messages — along with context such as the page
        you&apos;re on, your current search criteria, your basket, and your Lender ID if set — are
        sent to our server, which forwards them to <strong>OpenAI</strong> to generate replies.
      </p>
      <p>
        We <strong>log these conversations</strong> (your messages, the assistant&apos;s responses,
        which tools it used, and token/cost metadata) on our server and use them to: understand how
        the assistant is used, debug and troubleshoot, monitor and limit cost and abuse, and review
        and improve the assistant&apos;s helpfulness and accuracy. Logs are associated with a random
        per-browser identifier (and your Lender ID if you&apos;ve set one) and may be reviewed by the
        operator, including via a periodic internal summary.
      </p>
      <p>
        <strong>
          Please don&apos;t put sensitive personal information (passwords, financial account numbers,
          government IDs, etc.) into the chat
        </strong>{' '}
        — it isn&apos;t needed for anything KivaLens does. OpenAI processes your messages under its own
        terms and privacy policy; we don&apos;t control OpenAI&apos;s practices.
      </p>

      <h4>Anonymous diagnostics</h4>
      <p>
        KivaLens may send occasional anonymous “heartbeat” pings (a random install identifier and
        uptime) to keep loan data fresh and gauge active usage. These don&apos;t identify you.
      </p>

      <h4>Loans, partners, and lending</h4>
      <p>
        Loan, borrower, and field-partner information comes from Kiva&apos;s public API and the public
        “A+ Team” research spreadsheet. When you transfer your basket to Kiva, KivaLens hands the
        selected loan IDs to kiva.org, where you complete checkout in your own Kiva session.
        <strong> KivaLens does not process payments and never sees your payment details.</strong>
      </p>

      <h3>Third parties</h3>
      <ul>
        <li>
          <strong>Kiva</strong> (kiva.org, api.kivaws.org) — loan/partner/lender data and basket
          checkout.
        </li>
        <li>
          <strong>OpenAI</strong> — powers the AI assistant (receives your chat messages and context).
        </li>
        <li>
          <strong>Google Docs</strong> — hosts the public A+ Team research sheet we read.
        </li>
        <li>
          <strong>Hosting &amp; infrastructure</strong> (e.g. Heroku) and a managed datastore where AI
          conversation logs and operational data are kept.
        </li>
      </ul>
      <p>Each third party has its own privacy practices.</p>

      <h3>Cookies &amp; tracking</h3>
      <p>
        KivaLens does not use advertising or cross-site tracking cookies. It uses your browser&apos;s
        local storage for preferences and a random identifier for AI-chat logging, as described above.
      </p>

      <h3>Data retention</h3>
      <p>
        Browser-stored data persists until you clear it. AI conversation logs are retained on our
        server for the purposes above and are periodically rotated/expired; we keep them only as long
        as useful.
      </p>

      <h3>Your choices</h3>
      <p>
        You can use most of KivaLens without a Lender ID and without the assistant — you can turn the
        AI assistant off entirely in <Link to="/options">Options</Link>. Clearing your browser storage
        removes locally stored data (including your Lender ID and saved searches). To ask about or
        request deletion of AI logs, contact us (see below); note that logs keyed only by a random
        browser identifier can be hard to locate without it.
      </p>

      <h3>Children</h3>
      <p>
        KivaLens is not directed to children under 13 (or the minimum age in your jurisdiction), and we
        do not knowingly collect their information.
      </p>

      <h3>Changes</h3>
      <p>We may update this policy; the &ldquo;Last updated&rdquo; date above reflects the latest version.</p>

      <h3>Contact</h3>
      <p>
        Questions about privacy? See <Link to="/about">About</Link> for contact information.
      </p>
    </Container>
  )
}
