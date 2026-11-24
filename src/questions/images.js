import { callFunction } from '../api'
import { supabase } from '../supabase'

const BUCKET = 'question-images'
const MAX_SIDE = 1600

export function imageUrl(path) {
  return path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : null
}

// Phone photos can be 5+ MB; shrink to at most 1600px on the longest side so they upload
// fast and load quickly on the projector. GIFs are kept as-is so animations survive.
async function shrink(file) {
  if (file.type === 'image/gif') return { blob: file, extension: 'gif' }

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()

  // PNG keeps diagrams with sharp lines and text crisp; everything else becomes JPEG
  const keepPng = file.type === 'image/png'
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, keepPng ? 'image/png' : 'image/jpeg', 0.85)
  )

  return { blob, extension: keepPng ? 'png' : 'jpg' }
}

// Returns the stored path for a question's image_path
export async function uploadQuestionImage(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose a picture file (PNG, JPG, WEBP or GIF).')
  }

  const { blob, extension } = await shrink(file)

  if (blob.size > 3 * 1024 * 1024) {
    throw new Error('That picture is too large. Try a smaller one (under 3 MB).')
  }

  const { path, token } = await callFunction(
    'submit-questions',
    { action: 'image_upload_url', extension },
    'Could not upload the picture.'
  )

  const { error } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(path, token, blob, { contentType: blob.type || file.type })

  if (error) throw new Error('Could not upload the picture. Please try again.')

  return path
}
