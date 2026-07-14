import { useState, useEffect, useMemo } from 'react'
import { showLenderIDModal } from '../lib/showLenderIdModal'
import { useUtilsStore } from '../stores'
import { useI18n } from '../i18n'

interface PortfolioImage {
  thumb: string
  link: string
}

function randomBetween(low: number, high: number): number {
  return Math.floor(Math.random() * (high - low + 1)) + low
}

/**
 * 3D "Wall" of borrower face images from the lender's portfolio.
 * Placeholder implementation -- full version needs the LenderLoans API client.
 */
export default function Face() {
  const { t } = useI18n()
  const lenderId = useUtilsStore((s) => s.lenderId)
  const lenderDataVersion = useUtilsStore((s) => s.lenderDataVersion)
  const [images, _setImages] = useState<PortfolioImage[]>([])
  const [message, setMessage] = useState<React.ReactNode>('')

  useEffect(() => {
    if (lenderId) {
      setMessage(t('Loading loans for {lenderId}…', { lenderId }))
      // TODO: fetch portfolio via LenderLoans API
      // For now, show placeholder message
      setMessage(t('Portfolio wall for {lenderId} — loan fetching is not yet implemented.', { lenderId }))
    } else {
      setMessage(
        <>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              showLenderIDModal()
            }}
          >
            {t('Set your Lender ID')}
          </a>{' '}
          {t('to see your portfolio. Arrow keys move; space toggles magnification.')}
        </>,
      )
    }
  }, [lenderDataVersion, lenderId, t])

  const renderedImages = useMemo(
    () =>
      images.map((img, i) => {
        const z = randomBetween(-200, 200)
        return (
          <a key={i} href={img.link} target="_blank" rel="noopener noreferrer">
            <img
              src={img.thumb}
              style={{
                maxWidth: 200,
                maxHeight: 200,
                zIndex: z,
                transform: `rotateY(${randomBetween(-5, 5)}deg) translate3d(${randomBetween(-100, 100)}px,${randomBetween(-50, 50)}px,${z}px)`,
              }}
              alt=""
            />
          </a>
        )
      }),
    [images],
  )

  return (
    <div className="facepage" style={{ perspective: '800px' }}>
      <p>{message}</p>
      {renderedImages}
    </div>
  )
}
