import { useEffect, useState } from 'react'
import { impPrompts } from './api'
import ChapterPicker from './ChapterPicker'
import { Beam } from './ui'

const field = 'w-full rounded-lg border-2 border-line bg-panel px-3 py-2 text-ink outline-none placeholder-muted focus:border-accent'
const blank = () => ({ term: '', description: '', decoy: '', also: '' })

// The public form: pick a chapter, then add terms (each with a short description to teach from). They wait in
// Imposter's review queue until a reviewer approves them.
export default function PromptSubmit() {
  const [courses, setCourses] = useState(null)
  const [max, setMax] = useState(30)
  const [topicId, setTopicId] = useState('')
  const [rows, setRows] = useState([blank()])
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null) // { submitted, skipped }

  useEffect(() => {
    impPrompts({ action: 'places' })
      .then((data) => { setCourses(data.courses); setMax(data.max_prompts ?? 30) })
      .catch((e) => setError(e.message))
  }, [])

  const update = (i, key, value) => setRows(rows.map((r, k) => (k === i ? { ...r, [key]: value } : r)))
  const filled = rows.filter((r) => r.term.trim())

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await impPrompts({
        action: 'submit',
        topic_id: topicId,
        submitter_name: name,
        submitter_note: note,
        prompts: filled.map((r) => ({
          term: r.term,
          description: r.description,
          decoy: r.decoy,
          accepted_answers: r.also.split(',').map((a) => a.trim()).filter(Boolean),
        })),
      })
      setDone(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <main className="space-bg flex min-h-dvh items-center justify-center p-4 text-ink">
        <div className="w-full max-w-md overflow-hidden rounded-2xl border-2 border-ok bg-card text-center shadow-2xl">
          <Beam />
          <div className="p-8">
            <div className="text-5xl">🛸</div>
            <p className="mt-3 font-mono text-xs uppercase tracking-[0.4em] text-ok">● Transmission received</p>
            <h1 className="mt-2 font-display text-3xl uppercase text-ok">Thanks!</h1>
            <p className="mt-3">
              {done.submitted === 1 ? '1 term was' : `${done.submitted} terms were`} sent to the PLTL reviewers. Approved terms show up in the game.
            </p>
            {done.skipped?.length > 0 && (
              <p className="mt-2 text-sm text-muted">Already in that chapter, so skipped: {done.skipped.join(', ')}</p>
            )}
            <button onClick={() => { setDone(null); setRows([blank()]) }} className="mt-6 w-full rounded-lg bg-info px-5 py-3 font-bold text-black hover:brightness-110">
              Submit more terms
            </button>
            <a href="/" className="mt-3 block text-sm font-bold text-info">← Back to the game</a>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="space-bg min-h-dvh px-4 pb-10 text-ink">
      <Beam className="-mx-4 mb-6 h-2" />
      <form onSubmit={submit} className="mx-auto max-w-2xl space-y-6">
        <a href="/" className="inline-block text-sm font-bold text-info hover:brightness-125">← Back to the game</a>
        <header className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.4em] text-bad">● New terms needed</p>
          <h1 className="mt-2 font-display text-3xl uppercase tracking-wider text-accent glow-accent sm:text-4xl">Submit Terms</h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.3em] text-muted">PLTL Imposter</p>
          <p className="mt-3 text-muted">
            Each prompt is a <b className="text-ink">category</b> the crew gives examples of (&ldquo;Stages of mitosis&rdquo;:
            prophase, anaphase...). Add a <b className="text-ink">similar category</b> for the alien in hard mode
            (&ldquo;Cell cycle&rdquo;), so their clues almost fit (&ldquo;interphase&rdquo; gives them away).
            A PLTL reviewer checks each one before it&apos;s used. Up to {max} at a time.
          </p>
        </header>

        <section className="rounded-xl border border-line bg-card p-5">
          {!courses && !error && <p className="text-muted">Loading chapters…</p>}
          {courses && <ChapterPicker courses={courses} value={topicId} onPick={setTopicId} />}
          {courses?.length === 0 && <p className="text-muted">No courses are set up for Imposter yet.</p>}
        </section>

        {topicId && (
          <section className="space-y-3">
            {rows.map((r, i) => (
              <div key={i} className="holo space-y-2 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-xs uppercase tracking-widest text-muted">Term {i + 1}</p>
                  {rows.length > 1 && (
                    <button type="button" onClick={() => setRows(rows.filter((_, k) => k !== i))} className="text-xs font-bold text-bad">Remove</button>
                  )}
                </div>
                <input className={`${field} font-display text-lg uppercase`} maxLength={60} placeholder="Category (e.g. Stages of mitosis)"
                  value={r.term} onChange={(e) => update(i, 'term', e.target.value)} />
                <textarea className={field} rows={2} maxLength={600}
                  placeholder="Examples, shown after the round (e.g. prophase, metaphase, anaphase, telophase)"
                  value={r.description} onChange={(e) => update(i, 'description', e.target.value)} />
                <input className={field} maxLength={60} placeholder="Similar category for the alien in hard mode (e.g. Cell cycle)"
                  value={r.decoy} onChange={(e) => update(i, 'decoy', e.target.value)} />
                <input className={`${field} text-sm`} maxLength={200} placeholder="Also accept, comma separated (optional): other ways a caught alien could name it (e.g. Mitosis phases)"
                  value={r.also} onChange={(e) => update(i, 'also', e.target.value)} />
              </div>
            ))}
            {rows.length < max && (
              <button type="button" onClick={() => setRows([...rows, blank()])} className="w-full rounded-lg border-2 border-dashed border-line py-3 font-bold text-info hover:bg-hover">
                + Add another term ({rows.length}/{max})
              </button>
            )}
          </section>
        )}

        {topicId && (
          <section className="space-y-3 rounded-xl border border-line bg-card p-5">
            <input className={field} maxLength={80} placeholder="Your name (so reviewers can follow up)" value={name} onChange={(e) => setName(e.target.value)} required />
            <textarea className={field} rows={2} maxLength={500} placeholder="Note for the reviewer (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <button
              type="submit"
              disabled={busy || filled.length === 0 || !name.trim() || filled.some((r) => !r.description.trim())}
              className="w-full rounded-lg bg-accent px-5 py-3 font-bold uppercase text-on-accent hover:opacity-90 disabled:opacity-40"
            >
              {busy ? 'Sending…' : `Send ${filled.length || ''} term${filled.length === 1 ? '' : 's'} for review`}
            </button>
            {filled.some((r) => !r.description.trim()) && <p className="text-xs text-warn">Every category needs a few examples.</p>}
          </section>
        )}
        {error && <p className="font-bold text-bad">{error}</p>}
      </form>
    </main>
  )
}
