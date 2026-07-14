import { Container } from '../ui'
import { useI18n } from '../i18n'

export function Component() {
  const { t } = useI18n()
  return (
    <Container className="py-4">
      <h2>{t('Coming Soon')}</h2>
      <p>{t('This section is under construction.')}</p>
    </Container>
  )
}
