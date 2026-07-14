import { Container, Card } from '../ui'
import { useI18n } from '../i18n'

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
  const { t } = useI18n()
  return (
    <Container className="py-3">
      <h1>{t('Donate')}</h1>
      <h4>{t('KivaLens is now and will always be free to use for everyone. KivaLens is not a non-profit, so your donations are not tax deductible. If you find this site useful and would like to contribute anything to server or development costs, there are a few options. Thanks to everyone who has donated to help keep this running!')}</h4>

      <DonateItem title={t('PayPal')}>
        <NewTabLink className="btn btn-outline-secondary" href="https://paypal.me/nuclearspike">
          {t('PayPal Me')}
        </NewTabLink>{' '}
        {t("You're already using PayPal for Kiva, so this will probably be the easiest for most.")}
      </DonateItem>

      <DonateItem title={t('Kiva Gift Card')}>
        <NewTabLink
          className="btn btn-outline-secondary"
          href="https://www.kiva.org/gifts/kiva-cards?handle=nuclearspike#/lender"
        >
          {t('Send Kiva Gift Card')}
        </NewTabLink>
      </DonateItem>

      <DonateItem title={t('Amazon Wishlist')}>
        <NewTabLink
          className="btn btn-outline-secondary"
          href="http://www.amazon.com/registry/wishlist/3NRDPJN4K2FS2"
        >
          {t('Buy something from my wishlist')}
        </NewTabLink>
      </DonateItem>
    </Container>
  )
}
