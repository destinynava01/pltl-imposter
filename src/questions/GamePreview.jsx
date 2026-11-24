import { useEffect, useState } from 'react'
import QuestionImage from './QuestionImage'

// "Preview in game": how the question plays in Imposter. Its answer is the secret term: the crew's phones show
// the term, the alien's phone shows only the chapter. The question itself appears at the reveal, to teach from.
// `question` is { question_text, image_path, answer_text, accepted_answers }.

// The same rules as the server (imp-game): the term is the answer without parentheses, 1 to 4 words, no numbers
const termOf = (answer = '') => answer.replace(/[()]/g, '').replace(/\s+/g, ' ').trim()
function termProblem(answer) {
  const term = termOf(answer)
  if (!term) return 'There is no answer yet.'
  if (/\d/.test(term)) return 'Answers with numbers (like 100x) are left out of Imposter.'
  if (term.split(' ').length > 4) return 'Answers longer than 4 words are left out of Imposter.'
  if (term.length > 40) return 'Answers longer than 40 characters are left out of Imposter.'
  if (term.length < 2) return 'The answer is too short to be a term.'
  return null
}

// eslint-disable-next-line no-unused-vars
export default function GamePreviewButton({ question, lockNumber, className = '' }) {
  const [open, setOpen] = useState(false)
  const problem = termProblem(question.answer_text)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded-lg border px-3 py-1.5 text-xs font-bold hover:bg-hover ${problem ? 'border-warn text-warn' : 'border-info text-info'} ${className}`}
        title={problem ?? 'See how this term looks on the phones'}
      >
        👁 Preview in game{problem ? ' ⚠' : ''}
      </button>
      {open && <PreviewDialog question={question} problem={problem} onClose={() => setOpen(false)} />}
    </>
  )
}

function PreviewDialog({ question, problem, onClose }) {
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const term = termOf(question.answer_text)

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-4"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4 py-4" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold uppercase tracking-widest text-white">Student phones</p>
          <button type="button" onClick={onClose} className="rounded-lg bg-accent px-4 py-1.5 text-sm font-bold text-on-accent hover:opacity-90">
            Close
          </button>
        </div>

        {problem && (
          <p className="rounded-lg border-2 border-warn bg-warn-soft p-3 text-center font-bold text-warn">
            ⚠ {problem} It still works in the Escape Room.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Phone label="A crew member sees">
            <div className="holo rounded-2xl p-5 text-center">
              <p className="font-mono text-xs uppercase tracking-widest opacity-70">Your secret term · chapter</p>
              <p className="mt-1 font-display text-3xl uppercase leading-tight">{term || '(no answer yet)'}</p>
              <p className="mt-2 text-sm opacity-80">An alien in your crew doesn&apos;t have this. Don&apos;t say it!</p>
            </div>
          </Phone>
          <Phone label="The alien sees">
            <div className="rounded-2xl border-2 border-accent bg-accent-soft p-5 text-center box-glow-accent">
              <p className="text-5xl" aria-hidden="true">👽</p>
              <p className="mt-1 font-display text-2xl uppercase text-accent glow-accent">You&apos;re the alien</p>
              <p className="mt-2 font-mono text-sm">Topic: <b>the chapter</b></p>
            </div>
          </Phone>
        </div>

        <div className="rounded-2xl border-2 border-line bg-card p-5 text-ink">
          <p className="text-xs font-bold uppercase tracking-widest text-info">At the reveal, the projector shows</p>
          <p className="mt-2 font-display text-2xl uppercase">{term}</p>
          <p className="mt-2">{question.question_text || <span className="italic text-muted">(no question text yet)</span>}</p>
          <QuestionImage path={question.image_path} className="mt-3 max-h-56" />
          {(question.accepted_answers ?? []).filter(Boolean).length > 0 && (
            <p className="mt-2 text-sm text-muted">
              A caught alien&apos;s guess also counts if it matches: {question.accepted_answers.filter(Boolean).join(', ')}
            </p>
          )}
        </div>

        <p className="text-center text-xs text-neutral-300">Preview only. Nothing is saved or sent to a game.</p>
      </div>
    </div>
  )
}

function Phone({ label, children }) {
  return (
    <div>
      <p className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-muted">{label}</p>
      <div className="mx-auto w-full max-w-xs rounded-[2rem] border-4 border-line bg-panel p-3 shadow-2xl">{children}</div>
    </div>
  )
}
