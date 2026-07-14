import { useLocation, Link } from 'react-router-dom'
import { Navbar, Nav, Badge, Container } from '../ui'
import { useLoanStore, useUtilsStore } from '../stores'
import { LOCALES, useI18n, type Locale } from '../i18n'

export default function KLNav() {
  const location = useLocation()
  const { locale, setLocale, t } = useI18n()
  const basketCount = useLoanStore((s) => s.basket.length)
  const hasLenderId = Boolean(useUtilsStore((s) => s.lenderId))

  const isActive = (path: string) => location.pathname.startsWith(path)

  return (
    <Navbar bg="dark" variant="dark" expand="lg" sticky="top">
      <Container fluid>
        <Navbar.Brand as={Link} to="/search">
          KivaLens
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="kl-navbar-nav" aria-label={t('Toggle navigation')} />
        <Navbar.Collapse id="kl-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/search" active={isActive('/search')} data-aikl="nav-search">
              {t('Search')}
            </Nav.Link>
            <Nav.Link as={Link} to="/basket" active={isActive('/basket')} data-aikl="nav-basket">
              {t('Basket')} <Badge>{basketCount}</Badge>
            </Nav.Link>
            <Nav.Link as={Link} to="/partners" active={isActive('/partners')} data-aikl="nav-partners">
              {t('Partners')}
            </Nav.Link>
            <Nav.Link as={Link} to="/live" active={isActive('/live')} data-aikl="nav-stats">
              {t('Stats')}
            </Nav.Link>
            {hasLenderId && (
              <Nav.Link as={Link} to="/portfolio" active={isActive('/portfolio')} data-aikl="nav-wall">
                {t('Wall')}
              </Nav.Link>
            )}
            <Nav.Link as={Link} to="/teams" active={isActive('/teams')} data-aikl="nav-teams">
              {t('Teams')}
            </Nav.Link>
            <Nav.Link as={Link} to="/saved" active={isActive('/saved')} data-aikl="nav-saved">
              {t('Saved')}
            </Nav.Link>
            <Nav.Link as={Link} to="/options" active={isActive('/options')} data-aikl="nav-options">
              {t('Options')}
            </Nav.Link>
            <Nav.Link as={Link} to="/about" active={isActive('/about')} data-aikl="nav-about">
              {t('About')}
            </Nav.Link>
          </Nav>
          <label
            className="d-flex align-items-center gap-1 ms-lg-2 my-2 my-lg-0"
            title={t('Choose language')}
          >
            <span aria-hidden="true">🌐</span>
            <span className="visually-hidden">{t('Choose language')}</span>
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
              aria-label={t('Choose language')}
              style={{
                color: '#fff',
                background: '#23352f',
                border: '1px solid rgba(255,255,255,.35)',
                borderRadius: 4,
                padding: '3px 24px 3px 7px',
                fontSize: 13,
              }}
            >
              {LOCALES.map((option) => (
                <option key={option.code} value={option.code}>{option.label}</option>
              ))}
            </select>
          </label>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  )
}
