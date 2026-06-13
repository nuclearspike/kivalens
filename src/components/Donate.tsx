import { Container, Card } from '../ui'

function NewTabLink({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  )
}

function DonateItem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-3">
      <Card.Header>{title}</Card.Header>
      <Card.Body>{children}</Card.Body>
    </Card>
  )
}

export default function Donate() {
  return (
    <Container className="py-3">
      <h1>Donate</h1>
      <h4>
        KivaLens is now and will always be free to use for everyone. KivaLens is{' '}
        <i>not</i> a non-profit, so your donations are <i>not</i> tax deductible. If
        you find this site useful and would like to contribute anything to server or
        development costs, there are a few options. Thanks to everyone who has donated
        to help keep this running!
      </h4>

      <DonateItem title="PayPal">
        <NewTabLink className="btn btn-outline-secondary" href="https://paypal.me/nuclearspike">
          Pay Pal Me
        </NewTabLink>{' '}
        You&apos;re already using PayPal for Kiva, so this will probably be the easiest
        for most.
      </DonateItem>

      <DonateItem title="Kiva Gift Card">
        <NewTabLink
          className="btn btn-outline-secondary"
          href="https://www.kiva.org/gifts/kiva-cards?handle=nuclearspike#/lender"
        >
          Send Kiva Gift Card
        </NewTabLink>
      </DonateItem>

      <DonateItem title="Amazon Wishlist">
        <NewTabLink
          className="btn btn-outline-secondary"
          href="http://www.amazon.com/registry/wishlist/3NRDPJN4K2FS2"
        >
          Buy something from my wishlist
        </NewTabLink>
      </DonateItem>
    </Container>
  )
}
