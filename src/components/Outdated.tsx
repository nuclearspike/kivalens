import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Container } from '../ui'
import { useI18n } from '../i18n'

export default function Outdated() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const attempt = searchParams.get('attempt')
    if (attempt) {
      // TODO: store the outdated URL for display: useAppStore.getState().setOutdatedUrl(decodeURIComponent(attempt))
    }
    navigate('/search', { replace: true })
  }, [navigate, searchParams])

  return (
    <Container>
      <h4>{t('Outdated Link…')}</h4>
    </Container>
  )
}
