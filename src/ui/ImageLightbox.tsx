import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n'
import './ImageLightbox.scss'

/**
 * A picture enlarged over the page it was opened from: Escape, the Close button
 * and a click outside the picture all close it, focus moves to Close while it is
 * open and back to whatever opened it afterwards, the page behind is inert and
 * does not scroll, and a picture that fails to load says so with Close still
 * there. Every enlargeable image on the site opens this, never the image file's
 * own address.
 */
export function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const { t } = useI18n()
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
      } else if (e.key === 'Tab') {
        // Close is the only control, so focus stays on it.
        e.preventDefault()
        closeRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const root = document.getElementById('root')
    const wasInert = root?.inert ?? false
    if (root) root.inert = true
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      if (root) root.inert = wasInert
      opener?.focus({ preventScroll: true })
    }
  }, [])

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={alt} className="kl-lightbox" onClick={() => onCloseRef.current()}>
      {failed ? (
        <p className="kl-lightbox-error" role="alert" onClick={(e) => e.stopPropagation()}>
          {t('image_could_not_load')}
        </p>
      ) : (
        <img src={src} alt={alt} className="kl-lightbox-image" onError={() => setFailed(true)} />
      )}
      <button ref={closeRef} type="button" className="kl-lightbox-close" aria-label={t('close')} title={t('close')} onClick={() => onCloseRef.current()}>
        ×
      </button>
    </div>,
    document.body,
  )
}

/**
 * A picture on the page that enlarges in the lightbox when clicked or activated
 * from the keyboard. The thumbnail and its caption are one control.
 */
export function EnlargeableImage({
  src,
  alt,
  caption,
  width,
  height,
  className,
}: {
  src: string
  alt: string
  caption?: string
  width: number
  height: number
  className?: string
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  return (
    <figure className={['kl-enlargeable', className].filter(Boolean).join(' ')}>
      <button type="button" className="kl-enlargeable-button" onClick={() => setOpen(true)} title={t('click_enlarge')}>
        <img src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async" />
        {caption && <figcaption>{caption}</figcaption>}
      </button>
      {open && <ImageLightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </figure>
  )
}
