import { Container, Alert, Button } from '../ui'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import KLNav from './KLNav'
import KLFooter from './KLFooter'
import { useI18n } from '../i18n'

function describeError(error: unknown, t: (key: string) => string): { title: string; detail: string; stack?: string } {
  if (isRouteErrorResponse(error)) {
    return {
      title: `${error.status} ${error.statusText}`,
      detail: typeof error.data === 'string' ? error.data : t('The page could not be loaded.'),
    }
  }

  if (error instanceof Error) {
    return {
      title: t('Something went wrong'),
      detail: error.message || t('The page crashed while rendering.'),
      stack: error.stack,
    }
  }

  return {
    title: t('Something went wrong'),
    detail: t('The page crashed while rendering.'),
  }
}

export default function RouteErrorBoundary() {
  const { t } = useI18n()
  const error = useRouteError()
  const { title, detail, stack } = describeError(error, t)
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
               {t('Back to Search')}
            </Button>
            <Button variant="outline-secondary" onClick={() => window.location.reload()}>
               {t('Reload Page')}
            </Button>
          </div>
        </Alert>

        {showDebug ? (
          <details>
            <summary>{t('Technical details')}</summary>
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
