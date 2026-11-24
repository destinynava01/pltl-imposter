// Change these to rebrand and re-tune the game.
export const SITE_NAME = 'PLTL Imposter'
export const SITE_TAGLINE = 'Everyone knows the word. Except the alien.'
export const HUB_URL = 'https://pltl-game-hub.vercel.app'

// Thinking time before the clues start (seconds); the server allows 5 to 300
export const THINK_CHOICES = [15, 30, 45, 60, 90]
export const DEFAULT_THINK = 30

// Groups: the lobby starts with 2 and allows up to 8. A group needs 3 students to play a round.
export const MIN_GROUPS = 1
export const MAX_GROUPS = 8
export const MIN_GROUP_SIZE = 3
export const GROUP_COLORS = ['#e11d48', '#7c3aed', '#0891b2', '#d97706', '#16a34a', '#db2777', '#2563eb', '#64748b']

// Why a leader flags a term after a game (same list as the other game sites)
export const FLAG_REASONS = [
  { value: 'typo', label: 'Typo' },
  { value: 'content_mismatch', label: 'Term or question is wrong' },
  { value: 'other', label: 'Other' },
]
