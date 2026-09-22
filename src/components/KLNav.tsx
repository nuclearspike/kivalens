import { useLocation, Link } from 'react-router-dom'
import { Navbar, Nav, Badge, Container } from '../ui'
import { useLoanStore } from '../stores'
import { browserLanguageTags, matchLocale, useI18n, type Locale } from '../i18n'
import LanguageMenu from './LanguageMenu'

// "Switch to <language>" written IN each target language — the browser-language
// suggestion button is always shown in the language it offers, not the current UI.
const SWITCH_LABELS: Record<Locale, string> = {
  en: 'Switch to English',
  es: 'Cambiar a español',
  fr: 'Passer au français',
  de: 'Auf Deutsch wechseln',
  it: "Passa all'italiano",
  nl: 'Overschakelen naar Nederlands',
  'pt-BR': 'Mudar para português',
  ja: '日本語に切り替える',
  'zh-Hans': '切换到简体中文',
}
// Region-aware: a pt-BR or zh-CN browser resolves to a supported locale here,
// where a bare split('-')[0] would yield 'pt' / 'zh' and never match.
const browserLocale = matchLocale(browserLanguageTags())

export default function KLNav() {
  const location = useLocation()
  const { locale, setLocale, t } = useI18n()
  const basketCount = useLoanStore((s) => s.basket.length)

  const isActive = (path: string) => location.pathname.startsWith(path)

  return (
    <Navbar bg="dark" variant="dark" expand="lg" sticky="top">
      <Container fluid>
        <Navbar.Brand as={Link} to="/search">
          KivaLens
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="kl-navbar-nav" aria-label={t('toggle_navigation')} />
        <Navbar.Collapse id="kl-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/search" active={isActive('/search')} data-aikl="nav-search">
              {t('search')}
            </Nav.Link>
            <Nav.Link as={Link} to="/basket" active={isActive('/basket')} data-aikl="nav-basket">
              {t('basket')} <Badge>{basketCount}</Badge>
            </Nav.Link>
            <Nav.Link as={Link} to="/partners" active={isActive('/partners')} data-aikl="nav-partners">
              {t('partners')}
            </Nav.Link>
            <Nav.Link as={Link} to="/live" active={isActive('/live')} data-aikl="nav-stats">
              {t('stats')}
            </Nav.Link>
            <Nav.Link as={Link} to="/portfolio" active={isActive('/portfolio')} data-aikl="nav-wall">
              {t('wall')}
            </Nav.Link>
            <Nav.Link as={Link} to="/teams" active={isActive('/teams')} data-aikl="nav-teams">
              {t('teams')}
            </Nav.Link>
            <Nav.Link as={Link} to="/saved" active={isActive('/saved')} data-aikl="nav-saved">
              {t('saved')}
            </Nav.Link>
            <Nav.Link as={Link} to="/options" active={isActive('/options')} data-aikl="nav-options">
              {t('options')}
            </Nav.Link>
            <Nav.Link as={Link} to="/about" active={isActive('/about')} data-aikl="nav-about">
              {t('about')}
            </Nav.Link>
          </Nav>
          <LanguageMenu />
          {browserLocale && browserLocale !== locale && (
            <button
              type="button"
              className="btn btn-sm btn-outline-light ms-2 my-2 my-lg-0"
              onClick={() => setLocale(browserLocale)}
            >
              {SWITCH_LABELS[browserLocale]}
            </button>
          )}
        </Navbar.Collapse>
      </Container>
    </Navbar>
  )
}
