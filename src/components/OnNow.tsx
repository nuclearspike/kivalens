import { useState } from 'react'
import { Container, Row, Col, Form, Button } from '../ui'

interface OnNowLender {
  lender_id: string
  install: string
  uptime: string
  lender?: {
    name: string
    whereabouts: string
    loan_count: number
    member_since: string
    image?: { url: string }
  }
}

const ANON_IMAGE = 'https://www.kiva.org/img/s200/726677.jpg'

/**
 * Shows users currently on KivaLens (requires server-side stats endpoint with key).
 */
export default function OnNow() {
  const [key, setKey] = useState('')
  const [onNow] = useState<OnNowLender[]>([])
  const [on24Count] = useState(0)
  const [noResult, setNoResult] = useState(false)

  const refresh = async () => {
    // TODO: call GraphQL stats endpoint
    // const data = await fetch(...)
    // For now, just show placeholder
    setNoResult(true)
  }

  const getImg = (onL: OnNowLender) =>
    onL.lender?.image?.url ?? ANON_IMAGE

  return (
    <Container className="py-3">
      <Row className="mb-3">
        <Col md={3}>
          <Form.Group>
            <Form.Label>Key</Form.Label>
            <Form.Control
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </Form.Group>
          <Button variant="primary" className="mt-2" onClick={refresh}>
            GO
          </Button>
        </Col>
        <Col>{noResult && <span>BAD KEY</span>}</Col>
      </Row>
      <Row>
        {onNow.map((onL) => (
          <Col sm={3} key={onL.install} className="mb-3">
            <img
              src={getImg(onL)}
              style={{ width: 200, height: 200, display: 'block' }}
              alt={onL.lender_id}
            />
            <dl className="row mt-2">
              <dt className="col-4">lender</dt>
              <dd className="col-8">
                <a
                  href={`https://www.kiva.org/lender/${onL.lender_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {onL.lender_id}
                </a>
              </dd>
              <dt className="col-4">install</dt>
              <dd className="col-8">{onL.install}</dd>
              <dt className="col-4">uptime</dt>
              <dd className="col-8">{onL.uptime}</dd>
              <dt className="col-4">name</dt>
              <dd className="col-8">{onL.lender?.name ?? ''}</dd>
              <dt className="col-4">since</dt>
              <dd className="col-8">{onL.lender?.member_since ?? ''}</dd>
              <dt className="col-4">location</dt>
              <dd className="col-8">{onL.lender?.whereabouts ?? ''}</dd>
              <dt className="col-4">loans</dt>
              <dd className="col-8">{onL.lender?.loan_count ?? ''}</dd>
            </dl>
          </Col>
        ))}
      </Row>
      {on24Count > 0 && (
        <Row>
          <Col>On in last 24h: {on24Count}</Col>
        </Row>
      )}
    </Container>
  )
}
