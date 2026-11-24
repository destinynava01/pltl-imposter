import { useCallback, useEffect, useState } from 'react'
import { impPlay, watchGame } from './api'
import Picture from './Picture'
import { Button, CenterCard, Label, Beam } from './ui'
import { clock } from './time'

const STORAGE_KEY = 'pltlImposterStudent'
const DEVICE_KEY = 'pltlImposterDevice'
const field = 'w-full rounded-lg border-2 border-line bg-black/40 px-4 py-3 text-center font-mono text-xl text-ink outline-none placeholder-muted focus:border-info focus:outline-2 focus:outline-info'

// A random id this phone keeps, so one phone can't become two students
function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}
const readSaved = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') } catch { return null }
}
const writeSaved = (value) => {
  try { value ? localStorage.setItem(STORAGE_KEY, JSON.stringify(value)) : localStorage.removeItem(STORAGE_KEY) } catch { /* storage blocked */ }
}

// The phone: join with the code, wait for a group, then each round: see your secret, speak when it's your turn,
// vote, and (if you're the caught imposter) guess the term.
export default function StudentJoin() {
  const [saved, setSaved] = useState(readSaved)
  const [notice, setNotice] = useState('')

  const leave = useCallback((message = '') => {
    writeSaved(null)
    setSaved(null)
    setNotice(message)
  }, [])

  return saved
    ? <Room saved={saved} onLeave={leave} />
    : <JoinForm notice={notice} onJoined={(value) => { writeSaved(value); setSaved(value); setNotice('') }} />
}

function JoinForm({ onJoined, notice }) {
  const [code, setCode] = useState(() => (new URLSearchParams(window.location.search).get('code') ?? '').toUpperCase())
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function join(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await impPlay({ action: 'join', join_code: code, display_name: name, device_id: deviceId() })
      onJoined({ playerId: data.player.id, gameId: data.game.id })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <CenterCard title="Join the game">
      <form onSubmit={join} className="mt-4 space-y-4">
        {notice && <p className="font-bold text-muted">{notice}</p>}
        <div>
          <Label>Game code</Label>
          <input className={`${field} mt-2 uppercase tracking-widest`} maxLength={6} placeholder="ABC123" value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())} required autoCapitalize="characters" autoComplete="off" />
        </div>
        <div>
          <Label>Your name</Label>
          <input className={`${field} mt-2`} maxLength={40} placeholder="Maria G." value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <Button type="submit" variant="accent" disabled={busy || code.length < 6 || !name.trim()} className="w-full">
          {busy ? 'Joining…' : 'Join'}
        </Button>
        {error && <p className="font-bold text-bad">{error}</p>}
      </form>
    </CenterCard>
  )
}

function Room({ saved, onLeave }) {
  const [view, setView] = useState(null)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const check = useCallback(
    () =>
      impPlay({ action: 'status', player_id: saved.playerId, device_id: deviceId() })
        .then((data) => {
          if (data.ended) return onLeave('That game has ended. Join another with a new code.')
          setView({ ...data, offset: Date.parse(data.server_now) - Date.now() })
          setError('')
        })
        .catch((e) => {
          if (/not found|another phone/i.test(e.message)) return onLeave('You were removed from that game.')
          setError(e.message)
        }),
    [saved, onLeave],
  )

  useEffect(() => {
    check()
    return watchGame(saved.gameId, ['state', 'lobby'], check, 4000)
  }, [saved, check])

  const thinkEnds = view?.game?.think_ends_at ? Date.parse(view.game.think_ends_at) : 0
  const thinkingLeft = view ? (thinkEnds - (now + view.offset)) / 1000 : 0
  useEffect(() => {
    if (!thinkEnds) return undefined
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [thinkEnds])

  // When thinking time runs out, check right away (speaking starts)
  const thinkingNow = thinkingLeft > 0
  useEffect(() => {
    if (!thinkingNow && thinkEnds) check()
  }, [thinkingNow, thinkEnds, check])

  async function send(payload) {
    setSending(true)
    setError('')
    try {
      const result = await impPlay({ ...payload, player_id: saved.playerId, device_id: deviceId() })
      await check()
      return result
    } catch (e) {
      setError(e.message)
      return null
    } finally {
      setSending(false)
    }
  }

  if (!view) {
    return <CenterCard title="👽 Imposter"><p className="mt-4 text-muted">{error || 'Connecting…'}</p></CenterCard>
  }

  const { player, groups, round } = view
  const group = groups[player.team_index]
  let body

  if (player.approval_status !== 'approved') {
    body = <Panel title="Waiting for your leader" text="Your leader will put you in a group in a moment." />
  } else if (view.game.status === 'setup') {
    body = <Panel title={`You're in ${group?.name ?? 'a group'}`} text="Wait for your leader to start the game." />
  } else if (view.game.status === 'finished') {
    body = (
      <Panel title="Game over" text={`You finished #${player.place} of ${player.of} with ${player.score} point${player.score === 1 ? '' : 's'}.`} />
    )
  } else if (round) {
    body = <RoundView key={view.game.round_no} round={round} thinkingLeft={thinkingLeft} sending={sending} send={send} />
  } else {
    body = <Panel title={`You're in ${group?.name ?? 'a group'}`} text={view.sitting_out ?? 'Wait for the next round to start.'} />
  }

  return (
    <main className="space-bg min-h-dvh text-ink">
      <Beam className="h-1.5" />
      <div className="mx-auto max-w-md space-y-4 p-4">
        <header className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-bold">{player.display_name}</p>
            {group && (
              <p className="flex items-center gap-1.5 text-sm text-muted">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: group.color }} />{group.name}
                {view.game.round_no > 0 && <span> · round {view.game.round_no}</span>}
              </p>
            )}
          </div>
          {player.approval_status === 'approved' && view.game.status !== 'setup' && (
            <p className="text-right font-mono text-sm">
              <span className="text-2xl text-info">{player.score}</span> pts
              <span className="block text-xs text-muted">#{player.place} of {player.of}</span>
            </p>
          )}
        </header>

        {body}

        {error && <p className="text-center font-bold text-bad">{error}</p>}
        <p className="text-center">
          <button onClick={() => onLeave()} className="text-sm font-bold text-muted hover:text-ink">Leave game</button>
        </p>
      </div>
    </main>
  )
}

function Panel({ title, text }) {
  return (
    <section className="rounded-2xl border-2 border-line bg-card p-6 text-center">
      <h2 className="font-display text-2xl uppercase tracking-wide text-info">{title}</h2>
      <p className="mt-2 text-muted">{text}</p>
    </section>
  )
}

function RoundView({ round, thinkingLeft, sending, send }) {
  const [hidden, setHidden] = useState(false)
  const [guess, setGuess] = useState('')
  const thinking = round.thinking && thinkingLeft > 0
  const reveal = round.phase === 'reveal'

  return (
    <>
      {/* The secret: hidden on request so nobody can read it over your shoulder */}
      {!reveal && round.phase !== 'guess' && (
        <section className={`relative overflow-hidden rounded-2xl p-6 text-center ${round.imposter ? 'border-2 border-accent bg-accent-soft box-glow-accent' : 'holo'}`}>
          {hidden ? (
            <button type="button" onClick={() => setHidden(false)} className="w-full py-6 font-mono text-lg">👁 Tap to show your secret</button>
          ) : round.imposter ? (
            <>
              <p className="text-6xl" aria-hidden="true"><span className="hover-bob">👽</span></p>
              <p className="mt-2 font-display text-3xl uppercase text-accent glow-accent">You&apos;re the alien</p>
              <p className="mt-2 font-mono">Topic: <b>{round.chapter}</b></p>
              <p className="mt-2 text-sm text-muted">You don&apos;t know the term. Listen to the crew and give a clue that blends in.</p>
            </>
          ) : (
            <>
              <p className="font-mono text-xs uppercase tracking-widest opacity-70">Your secret term · {round.chapter}</p>
              <p className="mt-1 font-display text-4xl uppercase leading-tight">{round.term}</p>
              <p className="mt-2 text-sm opacity-80">An alien in your crew doesn&apos;t have this. Don&apos;t say it!</p>
            </>
          )}
          {!hidden && (
            <button type="button" onClick={() => setHidden(true)} className="mt-3 text-xs font-bold underline opacity-70">Hide</button>
          )}
        </section>
      )}

      {round.phase === 'speak' && thinking && (
        <section className="rounded-2xl border-2 border-info bg-card p-5 text-center box-glow-info">
          <Label>Thinking time</Label>
          <p className="font-display text-6xl text-info glow-info">{clock(thinkingLeft)}</p>
          <p className="mt-1 text-sm text-muted">Plan one clue. Speaking order:</p>
          <Order order={round.order} />
        </section>
      )}

      {round.phase === 'speak' && !thinking && (
        <section className={`rounded-2xl border-2 p-5 text-center ${round.my_turn ? 'spotlight border-info bg-info-soft' : 'border-line bg-card'}`}>
          {round.my_turn ? (
            <>
              <p className="text-5xl" aria-hidden="true">🎤</p>
              <p className="mt-1 font-display text-3xl uppercase text-info glow-info">Your turn!</p>
              <p className="mt-1">Say your clue out loud to your group.</p>
              <Button variant="accent" className="mt-4 w-full text-lg" disabled={sending} onClick={() => send({ action: 'done_speaking' })}>
                I&apos;m done ✓
              </Button>
            </>
          ) : (
            <>
              <Label>Clues</Label>
              <p className="mt-1 text-xl"><b>{round.speaker ?? 'Someone'}</b> is speaking</p>
              <Order order={round.order} />
            </>
          )}
        </section>
      )}

      {round.phase === 'vote' && (
        <section className="rounded-2xl border-2 border-accent bg-card p-5 box-glow-accent">
          <p className="text-center font-display text-2xl uppercase text-accent">Who&apos;s the alien?</p>
          <p className="text-center text-sm text-muted">{round.votes_in} of {round.voters} voted · you can change your vote until everyone has voted</p>
          <div className="mt-3 grid gap-2">
            {round.order.filter((p) => !p.me).map((p) => {
              const mine = round.my_vote === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={sending}
                  onClick={() => send({ action: 'vote', suspect_id: p.id })}
                  className={`rounded-xl border-2 px-4 py-3 text-lg font-bold transition ${mine ? 'border-accent bg-accent text-on-accent' : 'border-line bg-panel hover:bg-hover'}`}
                >
                  {mine ? '👉 ' : ''}{p.name}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {round.phase === 'guess' && (
        round.can_guess ? (
          <section className="rounded-2xl border-2 border-accent bg-accent-soft p-5 text-center box-glow-accent">
            <p className="stamp stamp-in text-2xl text-accent">Unmasked</p>
            <p className="mt-3 text-lg font-bold">You were the alien!</p>
            <p className="mt-1 text-sm text-muted">One guess: what was the group&apos;s secret term? Get it right and you still win.</p>
            <form
              className="mt-3 space-y-2"
              onSubmit={(e) => { e.preventDefault(); if (guess.trim()) send({ action: 'guess', guess }) }}
            >
              <input className={field} maxLength={80} placeholder="Your guess" value={guess} onChange={(e) => setGuess(e.target.value)} autoComplete="off" />
              <Button type="submit" className="w-full" disabled={sending || !guess.trim()}>Lock in my guess</Button>
            </form>
          </section>
        ) : (
          <Panel title="Caught!" text={`${round.imposter_name} was the alien. They get one guess at the term…`} />
        )
      )}

      {reveal && <RevealView round={round} />}
    </>
  )
}

function Order({ order }) {
  return (
    <ol className="mt-3 space-y-1 text-left">
      {order.map((p, k) => (
        <li key={p.id} className={`flex items-center gap-2 rounded-lg px-3 py-1 ${p.speaking ? 'bg-info-soft font-bold text-info' : p.done ? 'text-muted line-through' : ''}`}>
          <span className="w-5 font-mono text-xs">{k + 1}</span>
          <span className="flex-1">{p.name}{p.me ? ' (you)' : ''}</span>
          {p.speaking && <span aria-hidden="true">🎤</span>}
          {p.done && <span aria-hidden="true">✓</span>}
        </li>
      ))}
    </ol>
  )
}

// After the vote: did your side win, who it was, the term and the question behind it
function RevealView({ round }) {
  const imposterWon = !round.caught || round.guess_correct
  const iWon = round.you_were_imposter ? imposterWon : !imposterWon
  return (
    <section className="space-y-3">
      <div className={`rounded-2xl border-2 p-5 text-center ${iWon ? 'border-ok bg-ok-soft' : 'border-bad bg-bad-soft'}`}>
        <p className={`stamp stamp-in text-3xl ${iWon ? 'text-ok' : 'text-bad'}`}>{iWon ? 'You win' : 'You lose'}</p>
        <p className="mt-3 text-lg">
          {round.you_were_imposter ? 'You were' : <><b>{round.imposter_name}</b> was</>} the alien
          {!round.caught ? ' and got away.' : round.guess_correct ? `, got caught, but guessed it ("${round.guess}").` : ' and got caught.'}
        </p>
        {round.caught && !round.guess_correct && round.guess && <p className="text-sm text-muted">Their guess: &ldquo;{round.guess}&rdquo;</p>}
        {!round.caught && <p className="text-sm text-muted">{round.accused ? `Most votes went to ${round.accused}.` : 'The vote was a tie.'}</p>}
      </div>

      <div className="holo rounded-2xl p-5">
        <p className="font-mono text-xs uppercase tracking-widest opacity-70">The secret term</p>
        <p className="font-display text-3xl uppercase">{round.real_term}</p>
        {round.decoy_term && <p className="mt-1 font-mono text-sm">The alien had: <b>{round.decoy_term}</b></p>}
        {round.question_text && <p className="mt-3 border-t border-line pt-2 text-sm">{round.question_text}</p>}
        <Picture path={round.image_path} className="max-h-48" />
      </div>
      <p className="text-center text-sm text-muted">Waiting for the next round…</p>
    </section>
  )
}
