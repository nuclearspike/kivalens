import { useState, useEffect, useMemo } from 'react'
import { showLenderIDModal } from '../lib/showLenderIdModal'
import { useUtilsStore } from '../stores'

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
  const lenderId = useUtilsStore((s) => s.lenderId)
  const lenderDataVersion = useUtilsStore((s) => s.lenderDataVersion)
  const [images, _setImages] = useState<PortfolioImage[]>([])
  const [message, setMessage] = useState<React.ReactNode>('')

  useEffect(() => {
    if (lenderId) {
      setMessage(`Loading loans for ${lenderId}...`)
      // TODO: fetch portfolio via LenderLoans API
      // For now, show placeholder message
      setMessage(`Portfolio wall for ${lenderId} -- loan fetching not yet implemented.`)
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
            Set your Lender ID
          </a>{' '}
          to see your portfolio. Arrow keys to move, space toggles magnify.
        </>,
      )
    }
  }, [lenderDataVersion, lenderId])

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
