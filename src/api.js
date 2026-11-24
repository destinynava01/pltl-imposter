import { supabase } from './supabase'

// Every backend call goes through here. The backend is the shared Supabase project's Edge Functions.
export async function callFunction(name, payload, fallbackMessage) {
  if (!supabase) throw new Error('Supabase is not set up yet. See the README.')

  const { data, error } = await supabase.functions.invoke(name, { body: payload })
  if (error) {
    // Non-2xx responses leave data empty; the server's message is in the response body
    let message = error.message || fallbackMessage
    try {
      const errorBody = await error.context?.json()
      if (errorBody?.error) message = errorBody.error
    } catch {
      // Not JSON (e.g. a network failure): keep the fallback
    }
    throw new Error(message)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

// The leader's side (lobby, the projector board, results)
export const impGame = (payload) => callFunction('imp-game', payload, 'Unable to contact the game server.')

// The phones (join, status, done speaking, vote, guess)
export const impPlay = (payload) => callFunction('imp-play', payload, 'Unable to reach the game.')

// Calls onChange whenever the server signals one of `events` for this game ('lobby' = a student joined or was
// assigned, 'state' = a round moved on). Also checks every `fallbackMs` in case a signal is missed.
export function watchGame(gameId, events, onChange, fallbackMs = 15000) {
  if (!supabase) return () => {}
  let channel = supabase.channel(`imp-${gameId}`)
  for (const event of events) channel = channel.on('broadcast', { event }, () => onChange())
  channel.subscribe()
  const intervalId = setInterval(onChange, fallbackMs)
  return () => {
    clearInterval(intervalId)
    supabase.removeChannel(channel)
  }
}

// Imposter's own prompts: the chapters and the public submit form
export const impPrompts = (payload) => callFunction('imp-prompts', payload, 'Unable to reach the prompt server.')

// Reviewers (signed in): the prompt queue
export const impPromptReview = (payload) => callFunction('imp-prompt-review', payload, 'Unable to reach the review server.')
