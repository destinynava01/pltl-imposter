import { supabase } from './supabase'

// The public address of a question's picture (the shared "question-images" bucket)
export function imageUrl(path) {
  return path && supabase ? supabase.storage.from('question-images').getPublicUrl(path).data.publicUrl : null
}
