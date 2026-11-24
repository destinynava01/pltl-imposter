// The leader's game, remembered in this browser tab, so refreshing the page brings the game back instead of
// orphaning the students who joined it. sessionStorage: closing the tab forgets it.
// { gameId, hostToken, joinCode }
const KEY = 'pltlImposterLeader'

export function readSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null')
    return saved?.gameId && saved?.hostToken ? saved : null
  } catch {
    return null
  }
}

export function saveSession(session) {
  try {
    if (session) sessionStorage.setItem(KEY, JSON.stringify(session))
    else sessionStorage.removeItem(KEY)
  } catch {
    // storage blocked: the game just won't survive a refresh
  }
}
