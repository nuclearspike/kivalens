import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLoanStore, useUtilsStore } from '../stores'
import { LenderLoans } from '../api/kivajs/LenderLoans'

// ---------------------------------------------------------------------------
// SnowStack — the 3D CSS portfolio wall.
//
// A React re-implementation of the original Snow Stack engine
// (Charles Ying, 2009, Apache License 2.0) that the old app shipped as a
// global vendor script. Geometry, camera math, and interactions follow the
// original: cells in 3-row columns, a "dolly" that recenters the selected
// cell, a camera that swings while traveling, arrow-key navigation, and
// space to magnify. Reflections are a scaleY(-1) mirror of the wall with a
// gradient mask.
// ---------------------------------------------------------------------------

interface WallImage {
  id: number
  thumb: string
  link: string
  name: string
}

const ROWS = 3
const CGAP = 10

interface WallDims {
  CWIDTH: number
  CHEIGHT: number
  CXSPACING: number
  CYSPACING: number
}

function computeDims(): WallDims {
  // Original engine: cell height = innerHeight / (rows + 2), 300:180 aspect.
  const CHEIGHT = Math.round(window.innerHeight / (ROWS + 2))
  const CWIDTH = Math.round((CHEIGHT * 300) / 180)
  return { CWIDTH, CHEIGHT, CXSPACING: CWIDTH + CGAP, CYSPACING: CHEIGHT + CGAP }
}

function loanToWallImage(loan: {
  id: number
  name?: string
  image?: { id: number }
}): WallImage | null {
  if (!loan.image?.id) return null
  return {
    id: loan.id,
    thumb: `https://www.kiva.org/img/w800/${loan.image.id}.jpg`,
    link: `https://www.kiva.org/lend/${loan.id}`,
    name: loan.name ?? '',
  }
}

/** Aspect-fit an image inside its cell, centered (original engine math). */
function fitImage(img: HTMLImageElement, dims: WallDims) {
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  if (!iw || !ih) return
  const ratio = Math.min(dims.CHEIGHT / ih, dims.CWIDTH / iw)
  img.style.width = `${Math.round(iw * ratio)}px`
  img.style.height = `${Math.round(ih * ratio)}px`
  img.style.left = `${Math.round((dims.CWIDTH - iw * ratio) / 2)}px`
  img.style.top = `${Math.round((dims.CHEIGHT - ih * ratio) / 2)}px`
  img.style.opacity = '1'
}

export function Component() {
  const [searchParams] = useSearchParams()
  const savedLenderId = useUtilsStore((s) => s.lenderId)
  const lenderDataVersion = useUtilsStore((s) => s.lenderDataVersion)
  const lenderId = searchParams.get('kivaid') || savedLenderId

  const storeLoans = useLoanStore((s) => s.loans)

  const [images, setImages] = useState<WallImage[]>([])
  const [message, setMessage] = useState('Loading...')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(Math.floor(ROWS / 2))
  const [magnify, setMagnify] = useState(false)
  const [dims, setDims] = useState<WallDims | null>(null)
  const [navTop, setNavTop] = useState(44)

  const cameraRef = useRef<HTMLDivElement>(null)
  const dollyRef = useRef<HTMLDivElement>(null)
  const camTimer = useRef(0)

  // ---- layout: wall sits below the navbar; cell size from viewport ----
  useEffect(() => {
    const measure = () => {
      setDims(computeDims())
      const nav = document.querySelector('.navbar')
      setNavTop(nav ? Math.round(nav.getBoundingClientRect().bottom) : 44)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // ---- data: lender portfolio, or fundraising fallback without an ID ----
  useEffect(() => {
    let unmounted = false

    if (lenderId) {
      setLoading(true)
      setMessage(`Loading loans for ${lenderId}...`)
      new LenderLoans(lenderId, { max_pages: 10 })
        .start()
        .then((loans: Array<{ id: number; name?: string; image?: { id: number } }>) => {
          if (unmounted) return
          setImages(loans.map(loanToWallImage).filter((i): i is WallImage => i !== null))
          setMessage(
            `${lenderId}'s portfolio (up to 200): arrow keys to move, space toggles magnify.`,
          )
          setLoading(false)
        })
        .catch((err: unknown) => {
          if (unmounted) return
          setMessage(
            `Failed to load loans for ${lenderId}: ${err instanceof Error ? err.message : err}`,
          )
          setLoading(false)
        })
      return () => {
        unmounted = true
      }
    }

    // Fallback: interesting-photo loans first, then the rest (up to 201),
    // mirroring the original app's no-lender behavior.
    if (storeLoans.length) {
      const fundraising = storeLoans.filter((l) => l.status === 'fundraising')
      const tagged = fundraising.filter((l) =>
        l.tags?.some((t: { name?: string }) => t.name === '#InterestingPhoto'),
      )
      const taggedIds = new Set(tagged.map((l) => l.id))
      const rest = fundraising.filter((l) => !taggedIds.has(l.id))
      setImages(
        [...tagged, ...rest]
          .slice(0, 201)
          .map(loanToWallImage)
          .filter((i): i is WallImage => i !== null),
      )
      setMessage('Fundraising loans: arrow keys to move, space toggles magnify.')
      setLoading(false)
    } else {
      setLoading(true)
      setMessage('Loading...')
    }

    return () => {
      unmounted = true
    }
  }, [lenderId, lenderDataVersion, storeLoans])

  // Reset selection when the image set changes
  useEffect(() => {
    setSelected(Math.min(Math.floor(ROWS / 2), Math.max(images.length - 1, 0)))
    setMagnify(false)
  }, [images])

  // ---- keyboard: arrows move (native key repeat), space magnifies ----
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!images.length) return
      const move = (delta: (prev: number) => number) => {
        e.preventDefault()
        setSelected((prev) =>
          Math.min(Math.max(delta(prev), 0), images.length - 1),
        )
      }
      switch (e.key) {
        case 'ArrowLeft':
          move((prev) => (prev >= ROWS ? prev - ROWS : prev))
          break
        case 'ArrowRight':
          move((prev) => (prev + ROWS < images.length ? prev + ROWS : prev))
          break
        case 'ArrowUp':
          move((prev) => prev - 1)
          break
        case 'ArrowDown':
          move((prev) => prev + 1)
          break
        case ' ':
          e.preventDefault()
          setMagnify((m) => !m)
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [images.length])

  // ---- camera/dolly motion (original engine math) ----
  useLayoutEffect(() => {
    const dollyEl = dollyRef.current
    const camEl = cameraRef.current
    if (!dollyEl || !camEl || !images.length || !dims) return

    const col = Math.floor(selected / ROWS)
    const row = selected % ROWS
    const targetX = -(col + 0.5) * dims.CXSPACING
    const targetY = -(row + 0.5) * dims.CYSPACING

    // Swing the camera proportionally to how far the dolly must travel.
    let dx = 0
    const current = getComputedStyle(dollyEl).transform
    if (current && current !== 'none') {
      try {
        dx = new DOMMatrix(current).m41 - targetX
      } catch {
        dx = 0
      }
    }

    dollyEl.style.transform = `translate3d(${targetX}px, ${targetY}px, ${magnify ? 180 : 0}px)`

    const angle = Math.min(Math.max(dx / (dims.CXSPACING * 3), -1), 1) * 45
    if (angle !== 0) {
      camEl.style.transitionDuration = '330ms'
      camEl.style.transform = `rotateY(${angle}deg)`
      window.clearTimeout(camTimer.current)
      camTimer.current = window.setTimeout(() => {
        camEl.style.transitionDuration = '5s'
        camEl.style.transform = 'rotateY(0deg)'
      }, 330)
    }
  }, [selected, magnify, dims, images.length])

  useEffect(() => () => window.clearTimeout(camTimer.current), [])

  const cells = useMemo(() => {
    if (!dims) return []
    return images.map((image, n) => {
      const col = Math.floor(n / ROWS)
      const row = n % ROWS
      return {
        image,
        x: col * dims.CXSPACING,
        y: row * dims.CYSPACING,
      }
    })
  }, [images, dims])

  return (
    <div
      className="snowstack"
      style={{
        position: 'fixed',
        top: navTop,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'black',
        zIndex: 100,
      }}
    >
      {loading ? (
        <div
          className="d-flex justify-content-center align-items-center h-100 text-light"
          style={{ flexDirection: 'column', gap: 12 }}
        >
          <div className="spinner-border" role="status" />
          <div>{message}</div>
        </div>
      ) : (
        <div className="page view">
          <div className="origin view">
            <div ref={cameraRef} className="camera view">
              <div ref={dollyRef} className="dolly view">
                {dims && (
                  <div key={`wall-${dims.CWIDTH}`} className="view">
                    {cells.map(({ image, x, y }, n) => (
                      <div
                        key={image.id}
                        className={`cell view${
                          n === selected ? (magnify ? ' selected magnify' : ' selected') : ''
                        }`}
                        style={{
                          width: dims.CWIDTH,
                          height: dims.CHEIGHT,
                          transform: `translate3d(${x}px, ${y}px, 0)`,
                        }}
                      >
                        <a
                          className="mover view"
                          href={image.link}
                          target="_blank"
                          rel="noreferrer"
                          title={image.name}
                        >
                          <img
                            className="media"
                            src={image.thumb}
                            alt={image.name}
                            style={{ opacity: 0 }}
                            // cached images can be complete before onLoad
                            // attaches — fit them immediately via the ref
                            ref={(el) => {
                              if (el && el.complete && el.naturalWidth) fitImage(el, dims)
                            }}
                            onLoad={(e) => fitImage(e.currentTarget, dims)}
                          />
                        </a>
                      </div>
                    ))}
                    {/* Mirrored reflection of the wall below the bottom row */}
                    <div
                      className="view"
                      style={{
                        transform: `scaleY(-1) translate3d(0, ${-dims.CYSPACING * ROWS * 2 - 1}px, 0)`,
                      }}
                    >
                      {cells.map(({ image, x, y }) => (
                        <div
                          key={`r-${image.id}`}
                          className="cell view"
                          style={{
                            width: dims.CWIDTH,
                            height: dims.CHEIGHT,
                            transform: `translate3d(${x}px, ${y}px, 0)`,
                          }}
                        >
                          <img
                            className="media reflection"
                            src={image.thumb}
                            alt=""
                            style={{ opacity: 0 }}
                            ref={(el) => {
                              if (el && el.complete && el.naturalWidth) fitImage(el, dims)
                            }}
                            onLoad={(e) => fitImage(e.currentTarget, dims)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '8px 16px',
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: '#ccc',
          fontSize: 13,
          zIndex: 101,
        }}
      >
        {message}
      </div>
    </div>
  )
}
