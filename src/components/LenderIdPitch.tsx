import { useId, type ReactNode } from 'react'
import { Button } from '../ui'
import { useI18n } from '../i18n'
import { showLenderIDModal } from '../lib/showLenderIdModal'

/**
 * Stands in for a feature that needs the lender's Kiva lender ID when none is set:
 * what the space would show, and one button that opens the lender-ID dialog. The
 * space tells the lender what they would uncover instead of silently being empty.
 * `onBeforeOpen` runs just before the dialog opens (Teams arms its reload for when
 * the ID arrives).
 */
export default function LenderIdPitch({
  title,
  children,
  onBeforeOpen,
}: {
  title: string
  children: ReactNode
  onBeforeOpen?: () => void
}) {
  const { t } = useI18n()
  const titleId = useId()
  return (
    <aside className="kl-lender-pitch" aria-labelledby={titleId}>
      <div className="kl-lender-pitch-text">
        <h2 className="kl-lender-pitch-title" id={titleId}>
          {title}
        </h2>
        <p>{children}</p>
        {/* People hesitate to hand over what sounds like a credential; it is only a page name. */}
        <p className="kl-lender-pitch-hint">{t('lender_id_hint')}</p>
      </div>
      <Button
        variant="success"
        onClick={() => {
          onBeforeOpen?.()
          showLenderIDModal()
        }}
      >
        {t('set_lender_id_2')}
      </Button>
    </aside>
  )
}
