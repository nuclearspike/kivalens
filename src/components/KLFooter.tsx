import { Container, Row, Col } from '../ui'
import { Link } from 'react-router-dom'

export default function KLFooter() {
  return (
    <Container>
      <Row style={{ paddingTop: 20, paddingBottom: 50 }}>
        <Col md={12} className="pt-4 text-center">
          &copy;{new Date().getFullYear()} KivaLens is not supported by
          Kiva.org. See <Link to="/about">About</Link> for contact information.
        </Col>
      </Row>
    </Container>
  )
}
