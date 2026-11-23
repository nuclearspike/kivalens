import { useState } from 'react'
import type { KivaLoan } from '../types'
import cx from 'classnames'
import { useI18n } from '../i18n'
import { ImageLightbox } from '../ui/ImageLightbox'

interface KivaImageProps {
  loan?: KivaLoan
  image_id?: number
  image_width?: number
  width?: number
  height?: number
  type?: 'width' | 'square'
  useThumbAsBackground?: boolean
  /** When true, the image is clickable and opens a full-viewport lightbox. */
  enlargeable?: boolean
}

const ANON_IMAGE_ID = 726677

// Kiva serves borrower photos at a fixed set of sizes; w800 is the largest width
// reliably available (larger widths return 406 — the source isn't higher-res). The
// lightbox requests this and CSS fits it to the largest box that fits the viewport.
const MAX_WIDTH = 800

/**
 * Renders a Kiva borrower/lender image with a loading placeholder. Pass
 * `enlargeable` to make it open a click-to-zoom lightbox at the largest size
 * Kiva offers, sized to fill the viewport.
 * URL pattern: https://www.kiva.org/img/{w|s}{size}/{imageId}.jpg
 */
export default function KivaImage({
  loan,
  image_id: imageIdProp,
  image_width = 480,
  width,
  height,
  type = 'width',
  useThumbAsBackground = false,
  enlargeable = false,
}: KivaImageProps) {
  const { t } = useI18n()
  const [loaded, setLoaded] = useState(false)
  const [zoom, setZoom] = useState(false)

  const imageId = loan ? loan.image.id : (imageIdProp ?? ANON_IMAGE_ID)
  const altText = loan?.name ?? ''
  const imageDir = type === 'square' ? `s${image_width}` : `w${image_width}`
  const imageUrl = `https://www.kiva.org/img/${imageDir}/${imageId}.jpg`
  const largeUrl = `https://www.kiva.org/img/w${MAX_WIDTH}/${imageId}.jpg`

  const loadingImageUrl = useThumbAsBackground
    ? `https://www.kiva.org/img/s113/${imageId}.jpg`
    : `https://www.kiva.org/img/${imageDir}/${ANON_IMAGE_ID}.jpg`

  const style: React.CSSProperties = !loaded
    ? { backgroundImage: `url("${loadingImageUrl}")`, backgroundSize: 'cover' }
    : {}

  return (
    <div className={cx('KivaImage', { loaded, not_loaded: !loaded })} style={style}>
      {!loaded && <div className="loading_notice">{t('larger_version_loading_ellipsis')}</div>}
      {enlargeable ? (
        // A button, so the photo enlarges from the keyboard as well as by click.
        <button type="button" className="kl-image-button" onClick={() => setZoom(true)} title={t('click_enlarge')}>
          <img width={width ?? image_width} height={height} onLoad={() => setLoaded(true)} alt={altText} src={imageUrl} />
        </button>
      ) : (
        <img width={width ?? image_width} height={height} onLoad={() => setLoaded(true)} alt={altText} src={imageUrl} />
      )}

      {enlargeable && zoom && <ImageLightbox src={largeUrl} alt={altText || t('borrower_photo')} onClose={() => setZoom(false)} />}
    </div>
  )
}
