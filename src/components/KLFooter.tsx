import { Container, Row, Col } from '../ui'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'

export default function KLFooter() {
  const { t } = useI18n()
  return (
    <Container>
      <Row style={{ paddingTop: 20, paddingBottom: 50 }}>
        <Col md={12} className="pt-4 text-center">
          &copy;{new Date().getFullYear()} {t('KivaLens is not supported by Kiva.org. See')}{' '}
          <Link to="/about">{t('About')}</Link> {t('for contact information')} ·{' '}
          <Link to="/privacy">{t('Privacy')}</Link>
        </Col>
      </Row>
    </Container>
  )
}
