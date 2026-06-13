import { useRef, useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

interface InfiniteListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  itemHeight: number
  /** Fixed pixel height for the scroll container (the old app used 900). */
  height?: number
  className?: string
  onLoadMore?: () => void
  hasMore?: boolean
}

/**
 * Virtualized infinite-scroll list.
 * Only renders visible items plus a small buffer, using CSS transforms
 * for efficient positioning. An IntersectionObserver triggers onLoadMore
 * when the sentinel at the bottom enters the viewport.
 */
export default function InfiniteList<T>({
  items,
  renderItem,
  itemHeight,
  height,
  className,
  onLoadMore,
  hasMore = false,
}: InfiniteListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)

  // Measure container height on mount and resize
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setContainerHeight(el.clientHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // IntersectionObserver for "load more" sentinel
  useEffect(() => {
    if (!hasMore || !onLoadMore || !sentinelRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore()
      },
      { root: containerRef.current, rootMargin: '200px' },
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, onLoadMore])

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop)
    }
  }, [])

  const BUFFER = 4
  const totalHeight = items.length * itemHeight
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - BUFFER)
  const visibleCount = Math.ceil(containerHeight / itemHeight) + 2 * BUFFER
  const endIndex = Math.min(items.length, startIndex + visibleCount)

  const visibleItems: ReactNode[] = []
  for (let i = startIndex; i < endIndex; i++) {
    const item = items[i]
    if (item === undefined) continue
    visibleItems.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          top: i * itemHeight,
          left: 0,
          right: 0,
          height: itemHeight,
        }}
      >
        {renderItem(item, i)}
      </div>,
    )
  }

  return (
    <div
      ref={containerRef}
      className={className}
      onScroll={handleScroll}
      style={{ overflow: 'auto', position: 'relative', height: height ?? '100%' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems}
      </div>
      {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
    </div>
  )
}
