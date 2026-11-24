import { useCallback, useEffect, useState } from 'react'
import { impGame, watchGame } from './api'
import EndGame from './EndGame'
import Picture from './Picture'
import { MIN_GROUP_SIZE, SITE_NAME } from './config'
import { Button, Label, Tape } from './ui'
import { clock } from './time'

// The projector: thinking time, each group's speaking order and vote, then the reveal and the teaching moment.
// Secrets (the terms and who the imposter is) only reach this screen once a group has voted.
export default function Board({ session, onLobby, onNewGame }) {
  const [board, setBoard] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const call = useCallback(
    (payload) => impGame({ ...payload, game_id: session.gameId, host_token: session.hostToken }),
    [session],
  )

  const load = useCallback(
    () =>
      call({ action: 'board' })
        .then((data) => {
          // offset: server clock minus this computer's clock, so the countdown matches the phones
          setBoard({ ...data, offset: Date.parse(data.server_now) - Date.now() })
          setError('')
        })
        .catch((e) => setError(e.message)),
    [call],
  )

  useEffect(() => {
    load()
    return watchGame(session.gameId, ['state', 'lobby'], load, 5000)
  }, [session, load])

  // Tick the countdown while it's thinking time
  const thinkEnds = board?.game?.think_ends_at ? Date.parse(board.game.think_ends_at) : 0
  const thinkingLeft = board ? (thinkEnds - (now + board.offset)) / 1000 : 0
  useEffect(() => {
    if (!thinkEnds) return undefined
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [thinkEnds])

  async function act(payload, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(true)
    setError('')
    try {
      await call(payload)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!board) {
    return (
      <main className="noir-bg flex min-h-dvh items-center justify-center text-ink">
        <p className="text-muted">{error || 'Opening the case files…'}</p>
      </main>
    )
  }

  if (board.game.status === 'finished') {
    return <EndGame session={session} scores={board.scores} groups={board.groups} onNewGame={onNewGame} onLobby={onLobby} />
  }

  const thinking = thinkingLeft > 0
  const rounds = board.groups.filter((g) => g.round)
  const unfinished = rounds.filter((g) => g.round.phase !== 'reveal').length
  const allDone = rounds.length > 0 && unfinished === 0

  return (
    <main className="noir-bg min-h-dvh p-4 text-ink sm:p-6">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-info">{SITE_NAME} · join code {session.joinCode}</p>
          <h1 className="font-display text-3xl uppercase tracking-wider text-accent glow-accent sm:text-4xl">
            {board.game.round_no > 0 ? `Round ${board.game.round_no}` : 'Ready'}
            {board.game.hard_mode && <span className="ml-3 align-middle font-mono text-sm text-warn">hard mode</span>}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {board.waiting > 0 && (
            <Button variant="accent" className="!px-4 !py-2 text-sm" onClick={onLobby}>
              {board.waiting} waiting to join
            </Button>
          )}
          <Button
            className="!px-4 !py-2 text-sm"
            disabled={busy}
            onClick={() =>
              allDone || rounds.length === 0
                ? act({ action: 'start_round' })
                : act({ action: 'start_round', force: true }, `${unfinished} group${unfinished === 1 ? ' is' : 's are'} still playing. Start the next round anyway?`)}
          >
            {board.game.round_no === 0 ? 'Start round 1' : 'Next round ▶'}
          </Button>
          <Button variant="outline" className="!px-4 !py-2 text-sm" onClick={onLobby}>Lobby</Button>
          <Button variant="outline" className="!px-4 !py-2 text-sm" disabled={busy}
            onClick={() => act({ action: 'end_game' }, 'End the game and show the final scores?')}>
            End game
          </Button>
        </div>
      </header>
      {error && <p className="mx-auto mt-3 max-w-7xl font-bold text-bad">{error}</p>}

      {thinking && (
        <section className="mx-auto mt-6 max-w-3xl overflow-hidden rounded-2xl border-2 border-info bg-card text-center box-glow-info">
          <Tape />
          <div className="p-6">
            <Label>Thinking time</Label>
            <p className="mt-2 font-display text-7xl text-info glow-info sm:text-8xl">{clock(thinkingLeft)}</p>
            <p className="mt-2 text-lg text-muted">Look at your phone. Plan one clue: precise enough to prove you know it, vague enough to hide it.</p>
            <Button variant="outline" className="mt-4 !px-4 !py-2 text-sm" disabled={busy} onClick={() => act({ action: 'end_think' })}>
              Start speaking now
            </Button>
          </div>
        </section>
      )}

      <div className="mx-auto mt-6 grid max-w-7xl gap-6 lg:grid-cols-[1fr_18rem]">
        <section className="grid gap-4 md:grid-cols-2">
          {board.groups.map((g) => (
            <GroupCard key={g.index} group={g} thinking={thinking} busy={busy}
              act={(action) => act({ action, group_index: g.index })} />
          ))}
        </section>

        <aside className="h-fit rounded-xl border-2 border-line bg-card p-4">
          <Label>Scoreboard</Label>
          {board.scores.length === 0 && <p className="mt-2 text-sm text-muted">No students yet.</p>}
          <ol className="mt-2 space-y-1">
            {board.scores.map((s, i) => (
              <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-5 text-right font-mono text-muted">{i + 1}</span>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: board.groups[s.group]?.color }} />
                  <span className="truncate font-bold">{s.name}</span>
                </span>
                <span className="font-mono text-info">{s.score}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 border-t border-line pt-2 text-xs text-muted">
            Imposter caught: everyone else in the group +1. Imposter gets away, or guesses the term: imposter +2.
          </p>
        </aside>
      </div>
    </main>
  )
}

const PHASE_LABEL = { speak: 'Clues', vote: 'Voting', guess: 'Last guess', reveal: 'Case closed' }

function GroupCard({ group, thinking, busy, act }) {
  const r = group.round
  return (
    <article className="overflow-hidden rounded-xl border-2 border-line bg-card shadow-lg" style={{ borderTopColor: group.color, borderTopWidth: 8 }}>
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <h2 className="font-display text-xl uppercase tracking-wide">{group.name}</h2>
        <span className="rounded-full border border-line px-3 py-0.5 font-mono text-xs uppercase text-muted">
          {r ? (thinking && r.phase === 'speak' ? 'Thinking' : PHASE_LABEL[r.phase]) : 'Sitting out'}
        </span>
      </div>

      <div className="p-4">
        {!r && (
          <p className="text-muted">
            {group.size < MIN_GROUP_SIZE
              ? `Needs at least ${MIN_GROUP_SIZE} students to play (has ${group.size}).`
              : 'Joins in next round.'}
          </p>
        )}

        {r && r.phase === 'speak' && (
          <>
            <ol className="space-y-1.5">
              {r.order.map((p, k) => (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 rounded-lg border-2 px-3 py-1.5 ${
                    p.speaking && !thinking ? 'spotlight border-info bg-warn-soft text-ink' : p.done ? 'border-transparent text-muted line-through' : 'border-line bg-panel'
                  }`}
                >
                  <span className="w-5 font-mono text-sm">{k + 1}</span>
                  <span className="flex-1 text-lg font-bold">{p.name}</span>
                  {p.speaking && !thinking && <span className="font-mono text-sm text-info">🎤 speaking</span>}
                  {p.done && <span aria-hidden="true">✓</span>}
                </li>
              ))}
            </ol>
            {!thinking && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" className="!px-3 !py-1.5 text-xs" disabled={busy} onClick={() => act('skip_speaker')}>Skip speaker</Button>
                <Button variant="outline" className="!px-3 !py-1.5 text-xs" disabled={busy} onClick={() => act('open_vote')}>Vote now</Button>
              </div>
            )}
          </>
        )}

        {r && r.phase === 'vote' && (
          <div className="text-center">
            <p className="font-display text-5xl text-accent glow-accent">{r.votes_in} / {r.voters}</p>
            <p className="mt-1 text-muted">voted. Who&apos;s the imposter?</p>
            <div className="mx-auto mt-3 h-2 max-w-xs overflow-hidden rounded-full bg-panel">
              <div className="h-full bg-accent transition-all" style={{ width: `${r.voters ? (100 * r.votes_in) / r.voters : 0}%` }} />
            </div>
            <Button variant="outline" className="mt-3 !px-3 !py-1.5 text-xs" disabled={busy || r.votes_in === 0} onClick={() => act('close_vote')}>
              Close the vote
            </Button>
          </div>
        )}

        {r && r.phase === 'guess' && (
          <div className="text-center">
            <p className="stamp stamp-in text-3xl text-ok">Caught</p>
            <p className="mt-3 text-lg"><span className="font-bold text-accent">{r.imposter}</span> was the imposter.</p>
            <p className="mt-1 text-muted">They get one guess at the term… if they get it, they still win.</p>
            <Button variant="outline" className="mt-3 !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => act('skip_guess')}>Skip the guess</Button>
          </div>
        )}

        {r && r.phase === 'reveal' && <Reveal r={r} />}
      </div>
    </article>
  )
}

// The case closed: who it was, how the vote went, and the term with the question it came from (to teach from)
function Reveal({ r }) {
  const imposterWon = !r.caught || r.guess_correct
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`stamp stamp-in text-2xl ${imposterWon ? 'text-accent' : 'text-ok'}`}>
          {!r.caught ? 'Got away' : r.guess_correct ? 'Stole it' : 'Caught'}
        </p>
        <p className="text-right">
          Imposter: <span className="font-bold text-accent">{r.imposter}</span>
          <span className="block text-sm text-muted">
            {r.accused ? `Most votes: ${r.accused}` : 'The vote was a tie'}
            {r.guess ? ` · guessed "${r.guess}"` : ''}
          </span>
        </p>
      </div>

      {r.tally?.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {r.tally.map((t) => (
            <li key={t.name} className={`rounded-full border px-2 py-0.5 ${t.imposter ? 'border-accent text-accent' : 'border-line text-muted'}`}>
              {t.name}: {t.votes}
            </li>
          ))}
        </ul>
      )}

      <div className="case-file mt-4 rounded-lg p-4">
        <p className="font-mono text-xs uppercase tracking-widest opacity-70">Secret term · {r.chapter}</p>
        <p className="font-display text-3xl uppercase">{r.term}</p>
        {r.decoy && <p className="mt-1 font-mono text-sm">The imposter had: <b>{r.decoy}</b></p>}
        {r.question_text && <p className="mt-3 border-t border-black/20 pt-2 text-sm">{r.question_text}</p>}
        <Picture path={r.image_path} className="max-h-48" />
      </div>
    </div>
  )
}
