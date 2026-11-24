import { useEffect, useState } from 'react'
import { callFunction } from '../api'
import { LAB_PROFESSOR } from '../config'
import BackToGame from './BackToGame'
import ChapterCard from './ChapterCard'
import GamePreviewButton from './GamePreview'
import { uploadQuestionImage } from './images'
import QuestionImage from './QuestionImage'
import { OpenAnswerField } from './choices'
import { Beam } from '../ui'

// The server accepts up to 20 per submission for Escape Room (one chapter)
const MAX_QUESTIONS = 20

function blankQuestion() {
  return { question_text: '', open_answer: '', accepted_answers: [], image_path: null, uploading: false }
}

const inputClass =
  'w-full rounded-lg border border-line bg-panel px-3 py-2 text-ink placeholder-muted'

const ADD_NEW = '__add_new__'

// A dropdown of existing names that ends with "+ Add new…", which swaps in a text box.
// With nothing to pick from (e.g. under a brand-new professor), it starts as the text box.
function PickOrAdd({ label, options, value, onChange, placeholder, disabled, maxLength }) {
  const [adding, setAdding] = useState(false)
  const isAdding = adding || options.length === 0

  if (disabled) {
    return (
      <select disabled className={`mt-2 ${inputClass} cursor-not-allowed opacity-50`}>
        <option>Choose the {label.toLowerCase()} above first</option>
      </select>
    )
  }

  if (isAdding) {
    return (
      <div className="mt-2">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          required
          autoFocus={adding}
          className={inputClass}
        />
        <span className="mt-1 flex justify-between text-xs">
          <span className="font-bold uppercase text-accent">New {label.toLowerCase()}</span>
          {options.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setAdding(false)
                onChange('')
              }}
              className="font-bold text-info hover:brightness-125"
            >
              Choose an existing one
            </button>
          )}
        </span>
      </div>
    )
  }

  return (
    <select
      value={value}
      onChange={(event) => {
        if (event.target.value === ADD_NEW) {
          setAdding(true)
          onChange('')
        } else {
          onChange(event.target.value)
        }
      }}
      required
      className={`mt-2 ${inputClass}`}
    >
      <option value="" disabled>
        Choose a {label.toLowerCase()}
      </option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
      <option value={ADD_NEW}>＋ Add new {label.toLowerCase()}…</option>
    </select>
  )
}

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()

// Turns a professor's questions into chapter cards: each chapter's questions (approved and
// waiting for review) for clicking open
function buildChapters(questions) {
  const chapters = []

  for (const question of questions) {
    let chapter = chapters.find((c) => sameName(c.topic, question.topic_name))
    if (!chapter) {
      chapter = { key: question.topic_name, topic: question.topic_name, position: question.topic_position, questions: [], pendingCount: 0 }
      chapters.push(chapter)
    }

    chapter.questions.push(question)
    if (question.status === 'pending') chapter.pendingCount += 1
  }

  for (const chapter of chapters) {
    chapter.questions.sort((a, b) => a.status.localeCompare(b.status))
  }

  return chapters.sort((a, b) =>
    a.position - b.position || a.topic.localeCompare(b.topic, undefined, { numeric: true })
  )
}

// "What's already here" for the chosen professor, loaded when opened
function ProfessorChapters({ course, professor, chapter }) {
  const [questions, setQuestions] = useState(null)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function load() {
    setLoading(true)
    setErrorMessage('')

    try {
      const data = await callFunction(
        'submit-questions',
        { action: 'professor_questions', course_name: course, professor_name: professor },
        'Could not load the questions already submitted.'
      )
      setQuestions(data.questions || [])
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  const chapters = questions ? buildChapters(questions) : []

  return (
    <details
      onToggle={(event) => {
        if (event.currentTarget.open) load()
      }}
      className="group rounded-xl border border-line bg-card"
    >
      <summary className="flex cursor-pointer select-none items-baseline justify-between gap-2 px-5 py-3">
        <span className="font-bold text-accent">
          <span className="mr-1 inline-block transition group-open:rotate-90">▸</span>
          What {professor.trim()} already has
        </span>
        <span className="text-xs text-muted">Avoid repeats</span>
      </summary>

      <div className="space-y-3 px-5 pb-5">
        {loading && !questions && <p className="text-sm text-muted">Loading...</p>}
        {errorMessage && <p className="text-sm text-bad">{errorMessage}</p>}

        {questions && chapters.length === 0 && (
          <p className="text-sm text-muted">Nothing here yet. You&apos;ll be the first to add questions.</p>
        )}

        {chapters.length > 0 && (
          <>
            <p className="text-xs text-muted">
              Questions this professor already has in the shared question bank (from every game), including
              ones still waiting for review. Open a chapter to see them and avoid repeats.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {chapters.map((c) => (
                <ChapterCard key={c.key} chapter={c} highlight={Boolean(chapter.trim()) && sameName(c.topic, chapter)} />
              ))}
            </div>
          </>
        )}
      </div>
    </details>
  )
}

// Public form for submitting up to 20 open-response questions for one chapter at a time.
// Everything goes to the review queue; nothing reaches a game until it's approved.
export default function SubmitQuestions() {
  const [catalog, setCatalog] = useState([])
  const [subject, setSubject] = useState('')
  const [course, setCourse] = useState('')
  const [professor, setProfessor] = useState(LAB_PROFESSOR)
  const [chapter, setChapter] = useState('')
  const [submitterName, setSubmitterName] = useState('')
  const [submitterNote, setSubmitterNote] = useState('')
  const [website, setWebsite] = useState('') // hidden spam trap
  const [questions, setQuestions] = useState([blankQuestion()])
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [submittedCount, setSubmittedCount] = useState(null)
  // Similar questions already in the bank, keyed by question index
  const [duplicates, setDuplicates] = useState({})

  useEffect(() => {
    callFunction('submit-questions', { action: 'catalog' }, 'Could not load courses.')
      .then((data) => setCatalog(data.courses || []))
      .catch(() => setCatalog([]))
  }, [])

  // Check for duplicates shortly after typing stops
  const duplicateCheckKey = JSON.stringify(
    questions.map((q) => [q.question_text.trim(), q.open_answer.trim()])
  )

  useEffect(() => {
    const toCheck = questions.map((q) => ({
      question_text: q.question_text.trim(),
      answer_text: q.open_answer.trim(),
    }))

    if (!toCheck.some((q) => q.question_text.length >= 12)) return

    const timeoutId = setTimeout(() => {
      callFunction('submit-questions', { action: 'check_duplicates', questions: toCheck })
        .then((data) => setDuplicates(data.matches || {}))
        .catch(() => {
          // The check is a convenience; never block submitting over it
        })
    }, 700)

    return () => clearTimeout(timeoutId)
    // Keyed on text + answers only, so adding a picture or alternative doesn't trigger a new lookup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicateCheckKey])

  // Suggestions from what's already approved, so names stay consistent
  const professors = catalog.find((c) => c.course_name === course)?.professors ?? []
  const chapters =
    professors.find((p) => p.professor_name.toLowerCase() === professor.trim().toLowerCase())?.topics ?? []

  function updateQuestion(index, changes) {
    setQuestions((current) => current.map((q, i) => (i === index ? { ...q, ...changes } : q)))
  }

  function addQuestion() {
    if (questions.length < MAX_QUESTIONS) setQuestions((current) => [...current, blankQuestion()])
  }

  async function attachImage(index, file) {
    if (!file) return
    setErrorMessage('')
    updateQuestion(index, { uploading: true })

    try {
      const path = await uploadQuestionImage(file)
      updateQuestion(index, { image_path: path, uploading: false })
    } catch (error) {
      updateQuestion(index, { uploading: false })
      setErrorMessage(`Question ${index + 1}: ${error.message}`)
    }
  }

  function removeQuestion(index) {
    setQuestions((current) => current.filter((_, i) => i !== index))
    setDuplicates({})
  }

  // Subjects in catalog order; courses are filtered to the chosen subject
  const subjects = [...new Set(catalog.map((c) => c.subject_name))]
  const subjectCourses = catalog.filter((c) => c.subject_name === subject).map((c) => c.course_name)

  // Choosing a higher level clears the levels under it
  function chooseSubject(name) {
    setSubject(name)
    chooseCourse('')
  }

  function chooseCourse(name) {
    setCourse(name)
    // Lab questions are shared by every professor, so they start out filed under the shared lab set
    setProfessor(LAB_PROFESSOR)
    setChapter('')
  }

  function chooseProfessor(name) {
    setProfessor(name)
    setChapter('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')

    const missingAnswer = questions.findIndex((q) => !q.open_answer.trim())
    if (missingAnswer !== -1) {
      setErrorMessage(`Question ${missingAnswer + 1}: type the correct answer.`)
      return
    }

    setSubmitting(true)

    try {
      const data = await callFunction(
        'submit-questions',
        {
          action: 'submit',
          course_name: course,
          professor_name: professor,
          topic_name: chapter,
          category_name: '',
          submitter_name: submitterName,
          submitter_note: submitterNote,
          website,
          questions: questions.map((q) => ({
            question_text: q.question_text,
            question_type: 'open_response',
            choices: [],
            answer_text: q.open_answer.trim(),
            accepted_answers: q.accepted_answers.map((a) => a.trim()).filter(Boolean),
            image_path: q.image_path,
          })),
        },
        'Could not submit your questions.'
      )

      setSubmittedCount(data.count)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  function startAnother() {
    // Keep course/professor/chapter so the next batch is quicker to enter
    setQuestions([blankQuestion()])
    setDuplicates({})
    setSubmittedCount(null)
    setErrorMessage('')
  }

  if (submittedCount !== null) {
    return (
      <main className="space-bg flex min-h-dvh items-center justify-center p-4 text-ink">
        <div className="w-full max-w-md overflow-hidden rounded-2xl border-2 border-ok bg-card text-center shadow-2xl box-glow-ok">
          <Beam />
          <div className="p-8">
          <div className="text-5xl">🛸</div>
          <p className="mt-3 font-display text-xs font-bold uppercase tracking-[0.4em] text-ok">● Transmission received</p>
          <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-widest text-ok glow-ok">Thanks!</h1>
          <p className="mt-3 text-ink">
            {submittedCount === 1 ? 'Your question was' : `Your ${submittedCount} questions were`} sent
            to the PLTL reviewers. Approved questions will show up in the game.
          </p>
          <button
            onClick={startAnother}
            className="mt-6 w-full rounded-lg bg-info px-5 py-3 font-bold text-on-accent hover:brightness-110"
          >
            Submit More Questions
          </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="space-bg min-h-dvh px-4 pb-8 text-ink">
      <Beam className="-mx-4 mb-6 h-2" />
      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
        <BackToGame />

        <header className="text-center">
          <p className="font-display text-xs font-bold uppercase tracking-[0.4em] text-bad">● New terms needed</p>
          <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-widest text-accent glow-accent sm:text-4xl">Submit Questions</h1>
          <p className="mt-1 font-display text-[11px] font-bold uppercase tracking-[0.3em] text-muted">PLTL Imposter</p>
          <p className="mt-2 text-muted">
            Add up to {MAX_QUESTIONS} questions for one chapter. Each answer becomes a secret term the crew describes while the alien bluffs. Short answers (1 to 4 words, no numbers) work best.
            A PLTL reviewer checks each one before it&apos;s used.
          </p>
        </header>

        <section className="space-y-4 rounded-xl border border-line bg-card p-5">
          <div>
            <p className="font-bold text-accent">Subject</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {subjects.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => chooseSubject(name)}
                  aria-pressed={subject === name}
                  className={`rounded-lg border-2 px-2 py-2 text-sm font-bold transition ${
                    subject === name
                      ? 'border-accent bg-warn-soft text-accent'
                      : 'border-line bg-panel text-ink hover:bg-hover'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {subject && (
            <div>
              <p className="font-bold text-accent">Course</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {subjectCourses.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => chooseCourse(name)}
                    aria-pressed={course === name}
                    className={`rounded-lg border-2 px-2 py-2 text-sm font-bold transition ${
                      course === name
                        ? 'border-accent bg-warn-soft text-accent'
                        : 'border-line bg-panel text-ink hover:bg-hover'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Keys remount each picker when the level above changes, resetting "add new" mode */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="font-bold text-accent">Professor</span>
              <PickOrAdd
                key={`professor-${course}`}
                label="Professor"
                options={professors.map((p) => p.professor_name)}
                value={professor}
                onChange={chooseProfessor}
                placeholder="e.g. Robertson"
                maxLength={60}
                disabled={!course}
              />
              {course && (
                <span className="mt-1 block text-xs text-muted">
                  Lab questions are the same for every professor, so keep &ldquo;{LAB_PROFESSOR}&rdquo; unless this is only for one professor&apos;s class.
                </span>
              )}
            </div>

            <div>
              <span className="font-bold text-accent">Chapter / Topic</span>
              <PickOrAdd
                key={`chapter-${course}-${professor}`}
                label="Chapter"
                options={chapters.map((t) => t.topic_name)}
                value={chapter}
                onChange={setChapter}
                placeholder="e.g. Ch 3 Macromolecules"
                maxLength={80}
                disabled={!professor.trim()}
              />
            </div>
          </div>
        </section>

        {course && professor.trim() && (
          <ProfessorChapters key={`${course}|${professor.trim().toLowerCase()}`} course={course} professor={professor} chapter={chapter} />
        )}

        {questions.map((question, index) => (
          <section key={index} className="space-y-3 rounded-xl border border-line bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold text-accent">Question {index + 1}</h2>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <GamePreviewButton
                  question={{
                    question_text: question.question_text,
                    image_path: question.image_path,
                    choices: [],
                    answer_text: question.open_answer,
                    accepted_answers: question.accepted_answers,
                  }}
                  lockNumber={index + 1}
                />

                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(index)}
                    className="text-xs font-bold text-bad hover:brightness-125"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            <textarea
              value={question.question_text}
              onChange={(event) => updateQuestion(index, { question_text: event.target.value })}
              placeholder="Type the question"
              rows={2}
              maxLength={400}
              required
              className={inputClass}
            />

            {/* Optional picture, e.g. a labeled diagram or micrograph */}
            {question.image_path ? (
              <div className="space-y-2">
                <QuestionImage path={question.image_path} className="max-h-56" />
                <button
                  type="button"
                  onClick={() => updateQuestion(index, { image_path: null })}
                  className="block w-full text-center text-xs font-bold text-bad hover:brightness-125"
                >
                  Remove picture
                </button>
              </div>
            ) : (
              <label
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-sm text-muted hover:bg-hover ${
                  question.uploading ? 'pointer-events-none opacity-60' : ''
                }`}
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => {
                    attachImage(index, event.target.files?.[0])
                    event.target.value = ''
                  }}
                  className="hidden"
                />
                {question.uploading ? 'Uploading picture...' : '🖼️ Add a picture (optional)'}
              </label>
            )}

            {duplicates[index]?.length > 0 && (
              <div className="rounded-lg border border-accent bg-warn-soft p-3 text-sm">
                <p className="font-bold text-accent">
                  ⚠️ This looks similar to {duplicates[index].length === 1 ? 'a question' : 'questions'} already in the bank:
                </p>
                <ul className="mt-2 space-y-2">
                  {duplicates[index].map((match) => (
                    <li key={match.id} className="text-ink">
                      &ldquo;{match.question_text}&rdquo;
                      <span className="block text-xs text-muted">
                        {match.course_name} › {match.professor_name} › {match.topic_name}
                        {' · '}
                        {match.status === 'pending' ? 'waiting for review' : 'approved'}
                        {' · '}
                        {Math.round(match.score * 100)}% similar
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted">
                  If it&apos;s a different question, you can still submit it.
                </p>
              </div>
            )}

            <OpenAnswerField
              value={question.open_answer}
              onChange={(value) => updateQuestion(index, { open_answer: value })}
              alternatives={question.accepted_answers}
              onAlternativesChange={(list) => updateQuestion(index, { accepted_answers: list })}
            />
          </section>
        ))}

        {questions.length < MAX_QUESTIONS && (
          <button
            type="button"
            onClick={addQuestion}
            className="w-full rounded-lg border-2 border-dashed border-info px-5 py-3 font-bold text-info hover:bg-hover"
          >
            + Add another question for this chapter ({questions.length} of {MAX_QUESTIONS})
          </button>
        )}

        <section className="grid gap-4 rounded-xl border border-line bg-card p-5 sm:grid-cols-2">
          <label className="block">
            <span className="font-bold text-accent">Your name</span>
            <input
              value={submitterName}
              onChange={(event) => setSubmitterName(event.target.value)}
              maxLength={80}
              required
              className={`mt-2 ${inputClass}`}
            />
          </label>

          <label className="block">
            <span className="font-bold text-accent">Note for reviewers (optional)</span>
            <input
              value={submitterNote}
              onChange={(event) => setSubmitterNote(event.target.value)}
              placeholder="e.g. Based on the week 3 lecture"
              maxLength={500}
              className={`mt-2 ${inputClass}`}
            />
          </label>

          {/* Spam trap: hidden from people, but bots tend to fill it in */}
          <input
            type="text"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
          />
        </section>

        {errorMessage && (
          <p className="rounded-lg border border-bad bg-bad-soft p-3 text-center text-bad">
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !course || questions.some((q) => q.uploading)}
          className="w-full rounded-lg bg-accent px-5 py-4 text-lg font-black text-on-accent hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? 'Submitting...'
            : `Submit ${questions.length} Question${questions.length === 1 ? '' : 's'} for Review`}
        </button>
      </form>
    </main>
  )
}
