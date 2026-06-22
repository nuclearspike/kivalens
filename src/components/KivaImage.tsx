import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
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

  // Close the lightbox on Escape and lock body scroll while it's open.
  useEffect(() => {
    if (!zoom) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoom(false)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [zoom])

  return (
    <div className={cx('KivaImage', { loaded, not_loaded: !loaded })} style={style}>
      {!loaded && <div className="loading_notice">Larger version loading...</div>}
      <img
        width={width ?? image_width}
        height={height}
        onLoad={() => setLoaded(true)}
        alt={altText}
        src={imageUrl}
        onClick={enlargeable ? () => setZoom(true) : undefined}
        style={enlargeable ? { cursor: 'zoom-in' } : undefined}
        title={enlargeable ? 'Click to enlarge' : undefined}
      />

      {enlargeable &&
        zoom &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={altText || 'Borrower photo'}
            onClick={() => setZoom(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 2000,
              background: 'rgba(0, 0, 0, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'zoom-out',
              padding: '2vmin',
            }}
          >
            <img
              src={largeUrl}
              alt={altText}
              // Fill the largest box that fits the viewport, preserving aspect
              // ratio (object-fit:contain). w800 is Kiva's max source, so on very
              // large screens this upscales rather than fetching higher-res.
              style={{
                width: '96vw',
                height: '96vh',
                objectFit: 'contain',
                filter: 'drop-shadow(0 8px 40px rgba(0, 0, 0, 0.6))',
              }}
            />
            <button
              type="button"
              aria-label="Close"
              onClick={() => setZoom(false)}
              style={{
                position: 'fixed',
                top: 12,
                right: 18,
                fontSize: 34,
                lineHeight: 1,
                color: '#fff',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>,
          document.body,
        )}
    </div>
  )
}
