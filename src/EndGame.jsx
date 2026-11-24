import { useEffect, useState } from 'react'
import { impGame } from './api'
import Picture from './Picture'
import { FLAG_REASONS } from './config'
import { downloadResults } from './gameResults'
import { Button, Label, Tape } from './ui'

const field = 'w-full rounded-lg border-2 border-line bg-panel px-3 py-2 text-ink outline-none focus:outline-2 focus:outline-info'

// Game over: final scores (every student), the terms that were played (flag any that need fixing), and the
// results download. Same end-of-game tools as the other game sites.
export default function EndGame({ session, scores, groups, onNewGame, onLobby }) {
  const [rounds, setRounds] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  const loadRounds = () =>
    impGame({ action: 'review_rounds', game_id: session.gameId, host_token: session.hostToken })
      .then((data) => setRounds(data.rounds))
      .catch((e) => setError(e.message))

  useEffect(() => {
    impGame({ action: 'review_rounds', game_id: session.gameId, host_token: session.hostToken })
      .then((data) => setRounds(data.rounds))
      .catch((e) => setError(e.message))
  }, [session])

  async function download() {
    setDownloading(true)
    setError('')
    try {
      await downloadResults({ gameId: session.gameId, hostToken: session.hostToken })
    } catch (e) {
      setError(e.message || 'Could not download the results.')
    } finally {
      setDownloading(false)
    }
  }

  // Places with ties sharing a place
  const placed = scores.map((s, i) => ({ ...s, place: i > 0 && scores[i - 1].score === s.score ? null : i + 1 }))
  for (let i = 1; i < placed.length; i++) if (placed[i].place === null) placed[i].place = placed[i - 1].place
  const podium = placed.filter((s) => s.place <= 3 && s.score > 0)

  return (
    <main className="noir-bg min-h-dvh p-4 text-ink sm:p-8">
      <section className="mx-auto max-w-4xl overflow-hidden rounded-2xl border-2 border-line bg-card shadow-2xl">
        <Tape />
        <div className="p-6 text-center sm:p-8">
          <Label>Case closed</Label>
          <h1 className="mt-1 font-display text-4xl uppercase tracking-wider text-accent glow-accent sm:text-5xl">Final scores</h1>

          {podium.length > 0 && (
            <div className="mt-6 flex flex-wrap items-end justify-center gap-3">
              {podium.map((s) => (
                <div key={s.id} className={`case-file w-40 rounded-lg p-3 ${s.place === 1 ? 'pb-8' : ''}`}>
                  <p className="text-3xl">{s.place === 1 ? '🥇' : s.place === 2 ? '🥈' : '🥉'}</p>
                  <p className="truncate font-bold">{s.name}</p>
                  <p className="font-display text-2xl">{s.score} pts</p>
                </div>
              ))}
            </div>
          )}

          <ol className="mx-auto mt-6 max-w-md space-y-1 text-left">
            {placed.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-panel px-3 py-1.5">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-6 text-right font-mono text-muted">#{s.place}</span>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: groups[s.group]?.color }} />
                  <span className="truncate font-bold">{s.name}</span>
                  <span className="truncate text-xs text-muted">{groups[s.group]?.name}</span>
                </span>
                <span className="font-mono text-info">{s.score}</span>
              </li>
            ))}
          </ol>

          <div className="mx-auto mt-8 grid max-w-md gap-2 sm:grid-cols-2">
            <Button variant="accent" disabled={downloading} onClick={download}>
              {downloading ? 'Preparing…' : '⬇️ Results (.xlsx)'}
            </Button>
            <Button onClick={onNewGame}>New game</Button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Download and flag before starting a new game. New game closes this one (phones go back to the join page), and game data is cleared after 8 hours.
          </p>
          <button type="button" onClick={onLobby} className="mt-2 text-sm font-bold text-info hover:brightness-125">Back to the lobby</button>
          {error && <p className="mt-2 font-bold text-bad">{error}</p>}
        </div>
      </section>

      <section className="mx-auto mt-6 max-w-4xl">
        <h2 className="font-display text-2xl uppercase tracking-wider text-accent">Terms played</h2>
        <p className="text-sm text-muted">Something wrong with a term or its question? Flag it and a reviewer will fix it in the question bank.</p>
        {!rounds && !error && <p className="mt-3 text-muted">Loading…</p>}
        {rounds?.length === 0 && <p className="mt-3 text-muted">No rounds were played.</p>}
        <ul className="mt-3 space-y-3">
          {(rounds ?? []).map((r) => (
            <RoundRow key={`${r.round_no}-${r.group}`} r={r} session={session} onFlagged={loadRounds} />
          ))}
        </ul>
      </section>
    </main>
  )
}

function RoundRow({ r, session, onFlagged }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function send(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await impGame({
        action: 'flag_question', game_id: session.gameId, host_token: session.hostToken,
        question_id: r.question_id, reason, note, flagged_by: name,
      })
      setMessage(data.message)
      setOpen(false)
      onFlagged()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const result = !r.finished ? 'Not finished' : !r.caught ? 'Imposter got away' : r.guess_correct ? 'Caught, but guessed it' : 'Imposter caught'

  return (
    <li className="rounded-xl border-2 border-line bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">Round {r.round_no} · {r.group} · {r.chapter}</p>
          <p className="font-display text-2xl uppercase">{r.term}</p>
          <p className="text-sm text-muted">Imposter: <b className="text-ink">{r.imposter || '—'}</b> · {result}{r.guess ? ` · guessed "${r.guess}"` : ''}</p>
        </div>
        <div className="text-right">
          {r.flags.length > 0 && <p className="text-xs font-bold text-warn">🚩 Flagged</p>}
          <button type="button" onClick={() => setOpen(!open)} className="text-sm font-bold text-info hover:brightness-125">
            {open ? 'Cancel' : '🚩 Flag'}
          </button>
        </div>
      </div>
      {r.question_text && <p className="mt-2 text-sm">{r.question_text}</p>}
      <Picture path={r.image_path} className="max-h-40" />
      {message && <p className="mt-2 text-sm font-bold text-ok">{message}</p>}

      {open && (
        <form onSubmit={send} className="mt-3 space-y-2 rounded-lg border-2 border-dashed border-line p-3">
          <select className={field} value={reason} onChange={(e) => setReason(e.target.value)} required>
            <option value="" disabled>What&apos;s wrong?</option>
            {FLAG_REASONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <textarea className={field} rows={2} maxLength={1000} placeholder="Note for the reviewer" value={note} onChange={(e) => setNote(e.target.value)} required />
          <input className={field} maxLength={80} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Button type="submit" className="!px-4 !py-2 text-sm" disabled={busy || !reason || !note.trim() || !name.trim()}>
            {busy ? 'Sending…' : 'Send to reviewers'}
          </Button>
          {error && <p className="text-sm font-bold text-bad">{error}</p>}
        </form>
      )}
    </li>
  )
}
