import { useLocation, Link } from 'react-router-dom'
import { Navbar, Nav, Badge, Container } from '../ui'
import { useLoanStore, useUtilsStore } from '../stores'

export default function KLNav() {
  const location = useLocation()
  const basketCount = useLoanStore((s) => s.basket.length)
  const hasLenderId = Boolean(useUtilsStore((s) => s.lenderId))

  const isActive = (path: string) => location.pathname.startsWith(path)

  return (
    <Navbar bg="dark" variant="dark" expand="lg" sticky="top">
      <Container fluid>
        <Navbar.Brand as={Link} to="/search">
          KivaLens
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="kl-navbar-nav" />
        <Navbar.Collapse id="kl-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/search" active={isActive('/search')}>
              Search
            </Nav.Link>
            <Nav.Link as={Link} to="/basket" active={isActive('/basket')}>
              Basket <Badge>{basketCount}</Badge>
            </Nav.Link>
            <Nav.Link as={Link} to="/partners" active={isActive('/partners')}>
              Partners
            </Nav.Link>
            <Nav.Link as={Link} to="/live" active={isActive('/live')}>
              Stats
            </Nav.Link>
            {hasLenderId && (
              <Nav.Link as={Link} to="/portfolio" active={isActive('/portfolio')}>
                Wall
              </Nav.Link>
            )}
            <Nav.Link as={Link} to="/teams" active={isActive('/teams')}>
              Teams
            </Nav.Link>
            <Nav.Link as={Link} to="/saved" active={isActive('/saved')}>
              Saved
            </Nav.Link>
            <Nav.Link as={Link} to="/options" active={isActive('/options')}>
              Options
            </Nav.Link>
            <Nav.Link as={Link} to="/about" active={isActive('/about')}>
              About
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  )
}
