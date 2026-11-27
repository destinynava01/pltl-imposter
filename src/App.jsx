import { useEffect, useState } from 'react'
import { impGame } from './api'
import Board from './Board'
import Lobby from './Lobby'
import PromptReview from './PromptReview'
import PromptSubmit from './PromptSubmit'
import StudentJoin from './StudentJoin'
import { HUB_URL, SITE_NAME, SITE_TAGLINE } from './config'
import { readSession, saveSession } from './session'
import { isConfigured } from './supabase'
import { Button, CenterCard } from './ui'
import { SLIDES as LANDING_SLIDES } from './howToSlides'

// Routes:
//   /       leader: landing -> lobby -> board (the projector)
//   /join   student phone: join with the code, get a group, play each round
//   /submit public form: new terms (a term plus a short description), filed under a chapter
//   /review reviewers (same sign-in and reviewer list as the other sites): approve, edit, reject terms
// Terms are Imposter's own approved prompts and, if the leader turns it on, short multiple-choice answers.
function App() {
  const path = window.location.pathname.replace(/\/+$/, '')
  if (!isConfigured) return <NotConfigured />
  if (path === '/join') return <StudentJoin />
  if (path === '/submit') return <PromptSubmit />
  if (path === '/review') return <PromptReview />
  return <LeaderApp />
}

function LeaderApp() {
  const [saved] = useState(readSession) // a game this tab was running before the page loaded
  const [screen, setScreen] = useState(saved ? 'restoring' : 'landing') // restoring | landing | lobby | board
  const [session, setSession] = useState(null) // { gameId, hostToken, joinCode } once the game has started
  const [resume, setResume] = useState(null) // { session, teams, finalized } to rebuild the lobby
  const [lobbyNumber, setLobbyNumber] = useState(0)

  // After a refresh: ask the server for the game and put the leader back where they were
  useEffect(() => {
    if (!saved) return
    impGame({ action: 'get_state', game_id: saved.gameId, host_token: saved.hostToken })
      .then((data) => {
        const names = (data.teams ?? []).map((t) => t.name)
        const restored = { ...saved, joinCode: data.game.join_code }
        setResume({ session: restored, teams: names, finalized: names.length > 0 })
        if (data.game.status !== 'setup') {
          setSession(restored)
          setScreen('board')
        } else {
          setScreen('lobby')
        }
      })
      .catch(() => {
        saveSession(null)
        setScreen('landing')
      })
  }, [saved])

  // Close the game: students' phones go back to the join page, and the leader starts fresh
  async function closeGame() {
    const current = session ?? resume?.session ?? readSession()
    if (current) {
      try {
        await impGame({ action: 'close_game', game_id: current.gameId, host_token: current.hostToken })
      } catch {
        // Already gone
      }
    }
    saveSession(null)
    setSession(null)
    setResume(null)
    setLobbyNumber((n) => n + 1)
    setScreen('lobby')
  }

  if (screen === 'restoring') {
    return <CenterCard title={SITE_NAME}><p className="mt-4 text-muted">Restoring your game…</p></CenterCard>
  }

  if (screen === 'landing') {
    return (
      <CenterCard title={SITE_NAME}>
        <p className="mt-2 font-mono text-lg text-info">{SITE_TAGLINE}</p>
        <div className="mt-6 flex justify-center text-left [&>*]:max-w-full">{LANDING_SLIDES[0].art}</div>
        <p className="mt-4 text-muted">
          Every crew gets a secret term. One of them is an alien who doesn&apos;t know it. Take turns giving a clue out loud, then vote the alien out.
        </p>
        <Button className="mt-6" onClick={() => setScreen('lobby')}>👽 Open Leader Lobby</Button>
        <a href={HUB_URL} className="mt-4 block text-sm font-bold text-info hover:brightness-125">← All games</a>
      </CenterCard>
    )
  }

  // The lobby stays mounted (just hidden) so going back and forth keeps its state
  return (
    <>
      <div hidden={screen !== 'lobby'}>
        <Lobby
          key={lobbyNumber}
          resume={resume}
          hasGame={!!session}
          onOpenBoard={() => setScreen('board')}
          onCloseGame={closeGame}
          onStart={(started) => { setSession(started); setScreen('board') }}
        />
      </div>
      {session && screen === 'board' && (
        <Board session={session} onLobby={() => setScreen('lobby')} onNewGame={closeGame} />
      )}
    </>
  )
}

function NotConfigured() {
  return (
    <CenterCard title="Setup needed">
      <p className="mt-4 text-muted">
        Add your Supabase address and public key to <code>.env.local</code> (see <code>.env.example</code>), then restart.
      </p>
    </CenterCard>
  )
}

export default App
