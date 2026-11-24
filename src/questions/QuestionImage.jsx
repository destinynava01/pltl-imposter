import { imageUrl } from './images'

// A question's picture, scaled to fit without cropping (diagrams need every label visible)
export default function QuestionImage({ path, className = 'max-h-64' }) {
  if (!path) return null

  return (
    <img
      src={imageUrl(path)}
      alt="Picture for this question"
      className={`mx-auto w-auto max-w-full rounded-lg bg-white object-contain ${className}`}
    />
  )
}
