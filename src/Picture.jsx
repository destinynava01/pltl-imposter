import { useState } from 'react'
import { imageUrl } from './images'
import PictureZoom from './PictureZoom'

// A question's picture, scaled to fit (diagrams need every label visible); tap it to zoom in
export default function Picture({ path, className = 'max-h-56', title = 'Question picture' }) {
  const [zoomed, setZoomed] = useState(false)
  if (!path) return null
  return (
    <>
      <button type="button" onClick={() => setZoomed(true)} className="group relative mx-auto mt-3 block" aria-label="Zoom in on the picture">
        <img src={imageUrl(path)} alt={title} className={`mx-auto w-auto max-w-full rounded-lg bg-white object-contain ${className}`} />
        <span className="absolute bottom-2 right-2 rounded-md border border-accent bg-black/80 px-2 py-1 text-xs font-bold text-accent group-hover:bg-black">
          🔍 Tap to zoom
        </span>
      </button>
      {zoomed && <PictureZoom path={path} title={title} onClose={() => setZoomed(false)} />}
    </>
  )
}
