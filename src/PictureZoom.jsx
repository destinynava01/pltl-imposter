import { useEffect, useRef, useState } from 'react'
import { imageUrl } from './images'

const MIN_SCALE = 1
const MAX_SCALE = 8
const clamp = (value) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))

// Full-screen picture with zoom (wheel, buttons, double-click, pinch) and drag to pan.
// `panel` is shown beside it on wide screens (below on phones), e.g. the live round stats.
export default function PictureZoom({ path, onClose, panel = null, title = 'Picture' }) {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const pointers = useRef(new Map())
  const gesture = useRef(null)

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key === '+' || event.key === '=') zoomBy(1.25)
      if (event.key === '-') zoomBy(0.8)
      if (event.key === '0') reset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function zoomBy(factor) {
    setScale((current) => {
      const next = clamp(current * factor)
      if (next === 1) setOffset({ x: 0, y: 0 })
      return next
    })
  }

  function reset() {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }

  function startGesture() {
    const points = [...pointers.current.values()]
    gesture.current = {
      scale,
      offset,
      start: points[0],
      distance: points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0,
    }
  }

  function onPointerDown(event) {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    startGesture()
  }

  function onPointerMove(event) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const points = [...pointers.current.values()]
    const start = gesture.current

    if (points.length > 1 && start.distance > 0) {
      // Pinch
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
      setScale(clamp(start.scale * (distance / start.distance)))
    } else if (start.start) {
      // Drag to pan
      setOffset({
        x: start.offset.x + (points[0].x - start.start.x),
        y: start.offset.y + (points[0].y - start.start.y),
      })
    }
  }

  function onPointerUp(event) {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size > 0) startGesture()
    else gesture.current = null
  }

  const buttonClass =
    'rounded-lg border border-accent/60 bg-black/70 px-3 py-1.5 font-display text-sm font-bold text-accent hover:bg-black'

  return (
    <div className="space-bg fixed inset-0 z-[60] flex flex-col text-ink lg:flex-row" role="dialog" aria-modal="true" aria-label={title}>
      <div aria-hidden="true" className="beam pointer-events-none absolute inset-x-0 top-0 z-10 h-1.5" />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className="flex h-full w-full cursor-grab touch-none items-center justify-center active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(event) => zoomBy(event.deltaY < 0 ? 1.15 : 0.87)}
          onDoubleClick={() => (scale > 1 ? reset() : zoomBy(2.5))}
        >
          <img
            src={imageUrl(path)}
            alt={title}
            draggable={false}
            className="max-h-full max-w-full select-none rounded-md bg-white object-contain"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: 'center' }}
          />
        </div>

        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => zoomBy(1.25)} className={buttonClass} aria-label="Zoom in">＋</button>
          <button type="button" onClick={() => zoomBy(0.8)} className={buttonClass} aria-label="Zoom out">－</button>
          <button type="button" onClick={reset} className={buttonClass}>Fit</button>
          <span className="self-center rounded border border-line bg-black/70 px-2 py-1 font-mono text-xs text-ink">{Math.round(scale * 100)}%</span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg bg-accent px-4 py-1.5 font-display text-sm font-bold uppercase tracking-wider text-on-accent hover:opacity-90"
        >
          Close ✕
        </button>

        <p className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-xs text-muted">
          Scroll, pinch or double-click to zoom · drag to move
        </p>
      </div>

      {panel && (
        <aside className="max-h-[45vh] shrink-0 overflow-y-auto border-t-2 border-accent/50 bg-card p-4 text-ink lg:max-h-none lg:w-96 lg:border-l-2 lg:border-t-0">
          {panel}
        </aside>
      )}
    </div>
  )
}
