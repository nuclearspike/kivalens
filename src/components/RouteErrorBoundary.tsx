import { Container, Alert, Button } from '../ui'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import KLNav from './KLNav'
import KLFooter from './KLFooter'

function describeError(error: unknown): { title: string; detail: string; stack?: string } {
  if (isRouteErrorResponse(error)) {
    return {
      title: `${error.status} ${error.statusText}`,
      detail: typeof error.data === 'string' ? error.data : 'The page could not be loaded.',
    }
  }

  if (error instanceof Error) {
    return {
      title: 'Something went wrong',
      detail: error.message || 'The page crashed while rendering.',
      stack: error.stack,
    }
  }

  return {
    title: 'Something went wrong',
    detail: 'The page crashed while rendering.',
  }
}

export default function RouteErrorBoundary() {
  const error = useRouteError()
  const { title, detail, stack } = describeError(error)
  const showDebug = import.meta.env.DEV && !!stack

  return (
    <div>
      <KLNav />
      <Container className="py-4">
        <Alert variant="danger">
          <Alert.Heading>{title}</Alert.Heading>
          <p className="mb-3">{detail}</p>
          <div className="d-flex gap-2 flex-wrap">
            <Button variant="primary" href="#/search">
              Back to Search
            </Button>
            <Button variant="outline-secondary" onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </div>
        </Alert>

        {showDebug ? (
          <details>
            <summary>Technical details</summary>
            <pre className="mt-2 mb-0" style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
              {stack}
            </pre>
          </details>
        ) : null}
      </Container>
      <KLFooter />
    </div>
  )
}
