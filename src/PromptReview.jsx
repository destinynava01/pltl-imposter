import { useCallback, useEffect, useState } from 'react'
import { impPromptReview } from './api'
import { ChapterSelect } from './ChapterPicker'
import { SignIn, SignInCard } from './SignIn'
import { useSession } from './useSession'
import { supabase } from './supabase'
import { Beam } from './ui'

const field = 'w-full rounded-lg border-2 border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-accent'
const TABS = [
  { id: 'pending', label: 'Waiting' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'flagged', label: 'Flagged' },
]
const FLAG_LABELS = { typo: 'Typo', content_mismatch: 'Term or description is wrong', other: 'Other' }

// Reviewers: approve, edit or reject submitted terms, and handle terms flagged after a game
export default function PromptReview() {
  const session = useSession()
  if (session === undefined) return <SignInCard><p className="p-8 text-center text-muted">Checking access…</p></SignInCard>
  return session ? <Reviewer key={session.user.id} /> : <SignIn />
}

function Reviewer() {
  const [tab, setTab] = useState('pending')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [chapter, setChapter] = useState('') // filter: '' = every chapter
  const [picked, setPicked] = useState([]) // ids ticked for a bulk action
  const [me, setMe] = useState(null)

  const load = useCallback(() =>
    impPromptReview({ action: 'list', status: tab })
      .then((d) => { setData(d); setPicked([]); setError('') })
      .catch((e) => setError(e.message)), [tab])

  useEffect(() => {
    impPromptReview({ action: 'whoami' }).then(setMe).catch((e) => setError(e.message))
  }, [])
  useEffect(() => { load() }, [load])

  async function act(payload, done) {
    setError('')
    try {
      const result = await impPromptReview(payload)
      setMessage(done ?? result.message ?? '')
      await load()
      return true
    } catch (e) {
      setError(e.message)
      return false
    }
  }

  if (error && !me) {
    return (
      <SignInCard>
        <div className="p-6 text-center">
          <p className="text-4xl">🔒</p>
          <p className="mt-3">{error}</p>
          <button onClick={() => supabase.auth.signOut()} className="mt-4 font-bold text-info">Sign out</button>
        </div>
      </SignInCard>
    )
  }

  const prompts = (data?.prompts ?? []).filter((p) => !chapter || p.topic_id === chapter)
  // Chapters that have prompts in this tab, for the filter
  const chapters = [...new Map((data?.prompts ?? []).map((p) => [p.topic_id, `${p.course_name} · ${p.topic_name}`])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true }))
  const togglePick = (id) => setPicked((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]))

  return (
    <main className="space-bg min-h-dvh px-4 pb-10 text-ink">
      <Beam className="-mx-4 mb-6 h-2" />
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <a href="/" className="text-sm font-bold text-info hover:brightness-125">← Back to the game</a>
          <p className="text-sm text-muted">
            {me?.email} · <button onClick={() => supabase.auth.signOut()} className="font-bold text-info">Sign out</button>
          </p>
        </div>
        <header className="mt-2 text-center">
          <h1 className="font-display text-3xl uppercase tracking-wider text-accent glow-accent">Prompt Review</h1>
          <p className="mt-1 text-muted">Terms for PLTL Imposter. A term goes into games once it&apos;s approved.</p>
          <p className="mt-1 text-sm"><a href="/submit" className="font-bold text-info">+ Submit new terms</a></p>
        </header>

        <nav className="mt-6 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setChapter(''); setMessage('') }}
              className={`rounded-lg border-2 px-4 py-2 text-sm font-bold ${tab === t.id ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-panel hover:bg-hover'}`}>
              {t.label} {data?.counts && <span className="ml-1 font-mono text-xs opacity-80">{data.counts[t.id]}</span>}
            </button>
          ))}
        </nav>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select value={chapter} onChange={(e) => setChapter(e.target.value)} className={`${field} max-w-sm`}>
            <option value="">Every chapter ({data?.prompts?.length ?? 0})</option>
            {chapters.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          {tab === 'pending' && prompts.length > 0 && (
            <>
              <button onClick={() => setPicked(picked.length === prompts.length ? [] : prompts.map((p) => p.id))} className="text-sm font-bold text-info">
                {picked.length === prompts.length ? 'Clear selection' : `Select all ${prompts.length}`}
              </button>
              {picked.length > 0 && (
                <>
                  <button onClick={() => act({ action: 'set_status', ids: picked, status: 'approved' })}
                    className="rounded-lg bg-accent px-3 py-1.5 text-sm font-bold text-on-accent">✓ Approve {picked.length}</button>
                  <button onClick={() => act({ action: 'set_status', ids: picked, status: 'rejected' })}
                    className="rounded-lg border-2 border-bad px-3 py-1.5 text-sm font-bold text-bad">✕ Reject {picked.length}</button>
                </>
              )}
            </>
          )}
        </div>

        {message && <p className="mt-3 font-bold text-ok">{message}</p>}
        {error && <p className="mt-3 font-bold text-bad">{error}</p>}
        {!data && !error && <p className="mt-6 text-muted">Loading…</p>}
        {data && prompts.length === 0 && <p className="mt-6 text-muted">Nothing here.</p>}

        <ul className="mt-4 space-y-3">
          {prompts.map((p) => (
            <PromptCard key={p.id} p={p} tab={tab} courses={data.courses} picked={picked.includes(p.id)} onPick={() => togglePick(p.id)} act={act} />
          ))}
        </ul>
      </div>
    </main>
  )
}

function PromptCard({ p, tab, courses, picked, onPick, act }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)

  const startEdit = () => {
    setDraft({ term: p.term, description: p.description, also: p.accepted_answers.join(', '), topic_id: p.topic_id })
    setEditing(true)
  }
  async function save() {
    const ok = await act({
      action: 'save', id: p.id, term: draft.term, description: draft.description, topic_id: draft.topic_id,
      accepted_answers: draft.also.split(',').map((a) => a.trim()).filter(Boolean),
    }, 'Saved.')
    if (ok) setEditing(false)
  }

  return (
    <li className={`rounded-xl border-2 bg-card p-4 ${picked ? 'border-accent' : 'border-line'}`}>
      {!editing ? (
        <div className="flex gap-3">
          {tab === 'pending' && <input type="checkbox" checked={picked} onChange={onPick} className="mt-1.5 h-4 w-4 accent-green-400" aria-label={`Select ${p.term}`} />}
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs uppercase tracking-widest text-muted">{p.course_name} · {p.professor_name} · {p.topic_name}</p>
            <p className="font-display text-xl uppercase">{p.term}</p>
            <p className="mt-1 text-sm">{p.description}</p>
            {p.accepted_answers.length > 0 && <p className="mt-1 text-xs text-muted">Also accepts: {p.accepted_answers.join(', ')}</p>}
            <p className="mt-1 text-xs text-muted">
              From {p.submitter_name || 'unknown'}{p.submitter_note ? ` · "${p.submitter_note}"` : ''}
              {p.reviewed_by ? ` · ${p.status} by ${p.reviewed_by}` : ''}
            </p>
            {p.flag && (
              <p className="mt-2 rounded-lg border-2 border-warn bg-warn-soft p-2 text-sm text-warn">
                🚩 {FLAG_LABELS[p.flag.reason] ?? p.flag.reason}: {p.flag.note} <span className="text-xs">(from {p.flag.by})</span>
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2 text-sm font-bold">
              {p.status !== 'approved' && (
                <button onClick={() => act({ action: 'set_status', ids: [p.id], status: 'approved' })} className="rounded-lg bg-accent px-3 py-1 text-on-accent">✓ Approve</button>
              )}
              {p.status !== 'rejected' && (
                <button onClick={() => act({ action: 'set_status', ids: [p.id], status: 'rejected' })} className="rounded-lg border-2 border-bad px-3 py-1 text-bad">✕ Reject</button>
              )}
              {p.status !== 'pending' && (
                <button onClick={() => act({ action: 'set_status', ids: [p.id], status: 'pending' })} className="rounded-lg border-2 border-line px-3 py-1 hover:bg-hover">Back to waiting</button>
              )}
              <button onClick={startEdit} className="rounded-lg border-2 border-info px-3 py-1 text-info">✎ Edit</button>
              {p.flag && <button onClick={() => act({ action: 'clear_flag', id: p.id })} className="rounded-lg border-2 border-warn px-3 py-1 text-warn">Clear flag</button>}
              {p.status === 'rejected' && (
                <button onClick={() => window.confirm(`Delete "${p.term}" for good?`) && act({ action: 'delete', id: p.id })} className="px-2 py-1 text-bad">Delete</button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <input className={`${field} font-display text-lg uppercase`} maxLength={60} value={draft.term} onChange={(e) => setDraft({ ...draft, term: e.target.value })} />
          <textarea className={field} rows={2} maxLength={600} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          <input className={field} maxLength={200} placeholder="Also accept, comma separated" value={draft.also} onChange={(e) => setDraft({ ...draft, also: e.target.value })} />
          <ChapterSelect courses={courses} value={draft.topic_id} onChange={(topic_id) => setDraft({ ...draft, topic_id })} className={field} />
          <div className="flex gap-2 text-sm font-bold">
            <button onClick={save} className="rounded-lg bg-accent px-4 py-1.5 text-on-accent">Save</button>
            <button onClick={() => setEditing(false)} className="rounded-lg border-2 border-line px-4 py-1.5">Cancel</button>
          </div>
        </div>
      )}
    </li>
  )
}
