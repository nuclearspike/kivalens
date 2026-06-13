import { useState } from 'react'
import type { KivaLoan } from '../types'
import cx from 'classnames'

interface KivaImageProps {
  loan?: KivaLoan
  image_id?: number
  image_width?: number
  width?: number
  height?: number
  type?: 'width' | 'square'
  useThumbAsBackground?: boolean
}

const ANON_IMAGE_ID = 726677

/**
 * Renders a Kiva borrower/lender image with a loading placeholder.
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
}: KivaImageProps) {
  const [loaded, setLoaded] = useState(false)

  const imageId = loan ? loan.image.id : (imageIdProp ?? ANON_IMAGE_ID)
  const altText = loan?.name ?? ''
  const imageDir = type === 'square' ? `s${image_width}` : `w${image_width}`
  const imageUrl = `https://www.kiva.org/img/${imageDir}/${imageId}.jpg`

  const loadingImageUrl = useThumbAsBackground
    ? `https://www.kiva.org/img/s113/${imageId}.jpg`
    : `https://www.kiva.org/img/${imageDir}/${ANON_IMAGE_ID}.jpg`

  const style: React.CSSProperties = !loaded
    ? { backgroundImage: `url("${loadingImageUrl}")`, backgroundSize: 'cover' }
    : {}

  return (
    <div className={cx('KivaImage', { loaded, not_loaded: !loaded })} style={style}>
      {!loaded && <div className="loading_notice">Larger version loading...</div>}
      <img
        width={width ?? image_width}
        height={height}
        onLoad={() => setLoaded(true)}
        alt={altText}
        src={imageUrl}
      />
    </div>
  )
}
