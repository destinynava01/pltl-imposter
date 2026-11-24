import { useEffect, useState } from 'react'
import { callFunction } from '../api'
import { LAB_PROFESSOR } from '../config'
import BackToGame from './BackToGame'
import ChapterCard from './ChapterCard'
import GamePreviewButton from './GamePreview'
import { FLAG_REASONS } from './flagReasons'
import { uploadQuestionImage } from './images'
import QuestionImage from './QuestionImage'
import { OpenAnswerField } from './choices'
import { supabase } from '../supabase'
import SubjectManager from '../SubjectManager'
import { Beam } from '../ui'

const UTRGV_EMAIL = /^[^@\s]+@utrgv\.edu$/i
// How many approved questions a chapter should have for a good game (each round uses one term per crew)
const LOCKS_PER_GAME = 6

const inputClass =
  'w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink placeholder-muted'

const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()

function review(payload, fallback) {
  return callFunction('review', payload, fallback)
}

// <option>s for every course in the catalog, grouped under their subject
function CourseOptions({ catalog, current = '' }) {
  const subjects = []
  for (const course of catalog) {
    let subject = subjects.find((s) => s.name === course.subject_name)
    if (!subject) {
      subject = { name: course.subject_name, courses: [] }
      subjects.push(subject)
    }
    subject.courses.push(course.course_name)
  }

  const known = catalog.some((c) => c.course_name === current)

  return (
    <>
      {current && !known && <option value={current}>{current}</option>}
      {subjects.map((subject) => (
        <optgroup key={subject.name} label={subject.name}>
          {subject.courses.map((name) => <option key={name} value={name}>{name}</option>)}
        </optgroup>
      ))}
    </>
  )
}

// Reviewer area: sign in with a @utrgv.edu email, approve or reject submissions,
// and (supervisor only) manage who can review.
export default function ReviewDashboard() {
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCheckingSession(false)
    })

    // Also picks up the session when someone arrives from the email's sign-in link
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  if (checkingSession) {
    return <VaultShell><p className="p-8 text-center font-display text-sm uppercase tracking-widest text-muted">Checking access…</p></VaultShell>
  }

  return session ? <ReviewerArea key={session.user.id} session={session} /> : <SignIn />
}

function Shell({ children, wide = false }) {
  return (
    <main className="space-bg min-h-dvh px-4 pb-8 text-ink">
      <Beam className="-mx-4 mb-6 h-2" />
      <div className={`mx-auto ${wide ? 'max-w-5xl' : 'max-w-md'}`}>
        <BackToGame />

        <header className="mb-6 text-center">
          <p className="font-display text-xs font-bold uppercase tracking-[0.4em] text-bad">● Restricted area</p>
          <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-widest text-accent glow-accent">Question Review</h1>
          <p className="mt-1 font-display text-[11px] font-bold uppercase tracking-[0.3em] text-muted">PLTL Imposter</p>
        </header>
        {children}
      </div>
    </main>
  )
}

// The sign-in screen wears the game's space look (the review pages themselves stay light for reading)
function VaultShell({ children }) {
  return (
    <div className="theme-vault">
      <main className="space-bg flex min-h-dvh flex-col items-center justify-center px-4 py-8 text-ink">
        <div className="w-full max-w-md">
          <a href="/" className="mb-4 inline-block text-sm font-bold text-info hover:brightness-125">← Back to the game</a>
          <div className="overflow-hidden rounded-2xl border-2 border-line bg-card shadow-2xl">
            <Beam />
            <header className="px-6 pt-6 text-center">
              <p className="font-display text-xs font-bold uppercase tracking-[0.4em] text-bad">● Restricted area</p>
              <h1 className="mt-2 font-display text-2xl font-black uppercase tracking-widest text-accent glow-accent">Question Review</h1>
              <p className="mt-1 font-display text-[11px] font-bold uppercase tracking-[0.3em] text-muted">PLTL Imposter</p>
            </header>
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}

const vaultInput =
  'w-full rounded-lg border-2 border-line bg-black/50 px-4 py-3 font-mono text-lg text-ink outline-none placeholder-muted focus:border-accent focus:outline-2 focus:outline-accent'
const vaultButton =
  'w-full rounded-lg border-2 border-line px-5 py-3 font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-40'

function SignIn() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function sendLink(event) {
    event.preventDefault()
    setErrorMessage('')

    const cleanEmail = email.trim().toLowerCase()

    if (!UTRGV_EMAIL.test(cleanEmail)) {
      setErrorMessage('Use your @utrgv.edu email address.')
      return
    }

    setBusy(true)

    try {
      const access = await callFunction(
        'review-access',
        { email: cleanEmail },
        'Could not check your reviewer access.',
      )

      if (!access.authorized) {
        setErrorMessage('This email is not authorized to review questions. Ask the supervisor to add it.')
        setBusy(false)
        return
      }
    } catch (error) {
      setBusy(false)
      setErrorMessage(error.message)
      return
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: { emailRedirectTo: `${window.location.origin}/review` },
    })

    setBusy(false)

    if (error) {
      setErrorMessage(error.message)
    } else {
      setEmail(cleanEmail)
      setSent(true)
    }
  }

  // For when the email is opened on a different device than this one
  async function verifyCode(event) {
    event.preventDefault()
    setErrorMessage('')
    setBusy(true)

    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' })

    setBusy(false)
    if (error) setErrorMessage(error.message)
  }

  return (
    <VaultShell>
      <div className="p-6">
        {!sent ? (
          <form onSubmit={sendLink} className="space-y-4">
            <p className="text-center text-muted">
              Reviewers sign in with their UTRGV email. We&apos;ll email you a sign-in link, so there&apos;s no password.
            </p>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@utrgv.edu"
              aria-label="Your UTRGV email"
              required
              className={vaultInput}
            />
            <button type="submit" disabled={busy} className={`${vaultButton} bg-accent text-on-accent hover:opacity-90`}>
              {busy ? 'Checking clearance…' : '🔑 Email me a sign-in link'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-4">
            <div className="text-center text-4xl">📧</div>
            <p className="text-center">
              Check <span className="font-bold text-info">{email}</span> and click the sign-in link.
            </p>
            <p className="text-center text-sm text-muted">
              Opened it on another device? Enter the code from the email instead:
            </p>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="000000"
              aria-label="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              className={`${vaultInput} text-center text-2xl tracking-[0.5em]`}
            />
            <button type="submit" disabled={busy || code.trim().length < 6} className={`${vaultButton} bg-ok text-on-accent hover:brightness-110`}>
              {busy ? 'Checking…' : '👽 Sign in with code'}
            </button>
            <button
              type="button"
              onClick={() => { setSent(false); setCode('') }}
              className="w-full text-sm font-bold text-info hover:brightness-125"
            >
              Use a different email
            </button>
          </form>
        )}

        {errorMessage && (
          <p role="alert" className="shake mt-4 rounded-lg border-2 border-bad bg-bad-soft p-2 text-center text-sm font-bold text-bad">
            ⛔ {errorMessage}
          </p>
        )}
      </div>
    </VaultShell>
  )
}

function ReviewerArea({ session }) {
  const [me, setMe] = useState(null)
  const [accessError, setAccessError] = useState('')
  // Subjects & Courses is only reachable from this tab, for signed-in reviewers
  const [tab, setTab] = useState('queue')

  useEffect(() => {
    review({ action: 'whoami' }, 'Could not check your reviewer access.')
      .then(setMe)
      .catch((error) => setAccessError(error.message))
  }, [])

  const signOut = () => supabase.auth.signOut()

  if (accessError) {
    return (
      <Shell>
        <div className="rounded-2xl bg-card p-6 text-center shadow-xl">
          <div className="text-4xl">🔒</div>
          <p className="mt-3 text-ink">{accessError}</p>
          <p className="mt-2 text-sm text-muted">Signed in as {session.user.email}</p>
          <button onClick={signOut} className="mt-5 font-bold text-info hover:brightness-125">
            Sign out
          </button>
        </div>
      </Shell>
    )
  }

  if (!me) {
    return <Shell><p className="text-center text-muted">Checking access...</p></Shell>
  }

  return (
    <Shell wide>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <TabButton active={tab === 'queue'} onClick={() => setTab('queue')}>Review Queue</TabButton>
          <TabButton active={tab === 'bank'} onClick={() => setTab('bank')}>Question Bank</TabButton>
          <TabButton active={tab === 'subjects'} onClick={() => setTab('subjects')}>Subjects &amp; Courses</TabButton>
          {me.role === 'supervisor' && (
            <TabButton active={tab === 'reviewers'} onClick={() => setTab('reviewers')}>Reviewers</TabButton>
          )}
        </div>

        <p className="text-sm text-muted">
          {me.email} · {me.is_creator ? 'Creator' : me.role === 'supervisor' ? 'Supervisor' : 'Co-mentor'} ·{' '}
          <button onClick={signOut} className="font-bold text-info hover:brightness-125">Sign out</button>
        </p>
      </div>

      {tab === 'queue' && <ReviewQueue />}
      {tab === 'bank' && <QuestionBank />}
      {tab === 'subjects' && <SubjectManager isCreator={Boolean(me.is_creator)} />}
      {tab === 'reviewers' && <ReviewerManager myEmail={me.email} />}
    </Shell>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 font-display text-sm font-bold uppercase tracking-wider transition ${
        active ? 'bg-accent text-on-accent box-glow-accent' : 'border border-line bg-card text-ink hover:bg-hover'
      }`}
    >
      {children}
    </button>
  )
}

function ReviewQueue() {
  const [questions, setQuestions] = useState(null)
  const [catalog, setCatalog] = useState([])
  const [errorMessage, setErrorMessage] = useState('')

  async function load() {
    try {
      const data = await review({ action: 'list_pending' }, 'Could not load the review queue.')
      setQuestions(data.questions || [])
      setCatalog(data.catalog || [])
      setErrorMessage('')
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (errorMessage) return <p className="text-center text-bad">{errorMessage}</p>
  if (!questions) return <p className="text-center text-muted">Loading the queue...</p>

  // Chapter (course > professor > chapter), then each leader's submission
  const groups = []
  for (const question of questions) {
    const label = [question.course_name, question.professor_name, question.topic_name]
    const key = label.join(' › ')
    let group = groups.find((g) => g.key === key)
    if (!group) {
      group = { key, label, submissions: [], count: 0 }
      groups.push(group)
    }
    group.count++

    const leader = question.submitter_name || 'Anonymous'
    let submission = group.submissions.find((s) => s.key === leader)
    if (!submission) {
      submission = { key: leader, leader, submittedAt: question.submitted_at, questions: [] }
      group.submissions.push(submission)
    }
    if (question.submitted_at && (!submission.submittedAt || question.submitted_at < submission.submittedAt)) {
      submission.submittedAt = question.submitted_at
    }
    submission.questions.push(question)
  }

  for (const group of groups) {
    group.leaders = group.submissions.map((s) => s.leader)
  }

  return (
    <div className="space-y-6">
      <FlaggedQuestions catalog={catalog} />

      <ChapterProgress />

      {groups.length === 0 ? (
        <div className="rounded-xl border border-line bg-card p-8 text-center">
          <div className="text-4xl">✅</div>
          <p className="mt-2 text-ink">No questions waiting for review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted">
            {questions.length} questions waiting in {groups.length} chapter{groups.length === 1 ? '' : 's'}. Open a
            chapter, then a leader&apos;s submission, to review it.
          </p>

          {groups.map((group) => (
            <details key={group.key} className="group/chapter rounded-xl border border-line bg-card">
              <summary className="flex cursor-pointer select-none flex-wrap items-baseline justify-between gap-2 px-5 py-3">
                <span className="font-bold text-accent">
                  <span className="mr-1 inline-block transition group-open/chapter:rotate-90">▸</span>
                  {group.label.join(' › ')}
                </span>
                <span className="text-xs text-muted">
                  {group.count} pending · from {group.leaders.join(', ')}
                </span>
              </summary>

              <div className="space-y-3 px-4 pb-4">
                {group.submissions.map((submission) => (
                  <details key={submission.key} className="group/sub rounded-lg border border-line bg-panel">
                    <summary className="flex cursor-pointer select-none flex-wrap items-baseline justify-between gap-2 px-4 py-2 text-sm">
                      <span>
                        <span className="mr-1 inline-block transition group-open/sub:rotate-90">▸</span>
                        Pending review from: <span className="font-bold text-ink">{submission.leader}</span>
                      </span>
                      <span className="text-xs text-muted">
                        {submission.questions.length} question{submission.questions.length === 1 ? '' : 's'}
                        {submission.submittedAt && ` · ${new Date(submission.submittedAt).toLocaleDateString()}`}
                      </span>
                    </summary>

                    <div className="space-y-3 px-3 pb-3">
                      {submission.questions.map((question) => (
                        <PendingQuestion key={question.id} question={question} catalog={catalog} onDone={load} />
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}

// How many approved questions each chapter has toward a game (6 locks = 6 questions), loaded when opened
function ChapterProgress() {
  const [questions, setQuestions] = useState(null)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [filters, setFilters] = useState({ course: '', professor: '', status: 'all', search: '' })

  async function load() {
    if (questions || loading) return
    setLoading(true)
    setErrorMessage('')

    try {
      const data = await review({ action: 'list_bank', status: 'approved' }, 'Could not load the question counts.')
      setQuestions(data.questions || [])
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  // course > professor > chapter, with its approved question count
  const chapters = []
  for (const question of questions ?? []) {
    const key = [question.course_name, question.professor_name, question.topic_name].join('|')
    let chapter = chapters.find((c) => c.key === key)
    if (!chapter) {
      chapter = { key, course: question.course_name, professor: question.professor_name, topic: question.topic_name, questionCount: 0 }
      chapters.push(chapter)
    }
    chapter.questionCount++
  }
  chapters.sort((a, b) =>
    a.course.localeCompare(b.course) ||
    a.professor.localeCompare(b.professor) ||
    a.topic.localeCompare(b.topic, undefined, { numeric: true })
  )

  // Changing a level clears the levels under it
  function setLevel(key, value) {
    setFilters((current) => ({ ...current, ...(key === 'course' ? { professor: '' } : {}), [key]: value }))
  }

  const courses = [...new Set(chapters.map((c) => c.course))]
  const professors = [
    ...new Set(chapters.filter((c) => !filters.course || c.course === filters.course).map((c) => c.professor)),
  ].sort((a, b) => a.localeCompare(b))
  const search = filters.search.trim().toLowerCase()
  const isReady = (chapter) => chapter.questionCount >= LOCKS_PER_GAME

  const shown = chapters.filter((chapter) =>
    (!filters.course || chapter.course === filters.course) &&
    (!filters.professor || chapter.professor === filters.professor) &&
    (filters.status === 'all' || (filters.status === 'ready' ? isReady(chapter) : !isReady(chapter))) &&
    (!search || chapter.topic.toLowerCase().includes(search))
  )

  // Course › professor headings, each with a grid of chapter cards
  const groups = []
  for (const chapter of shown) {
    const key = `${chapter.course}|${chapter.professor}`
    let group = groups.find((g) => g.key === key)
    if (!group) {
      group = { key, course: chapter.course, professor: chapter.professor, chapters: [] }
      groups.push(group)
    }
    group.chapters.push(chapter)
  }

  const readyCount = chapters.filter(isReady).length
  const selectClass = `${inputClass} disabled:opacity-50`

  return (
    <details
      onToggle={(event) => {
        if (event.currentTarget.open) load()
      }}
      className="rounded-xl border border-line bg-card"
    >
      <summary className="cursor-pointer select-none px-5 py-3 font-bold text-accent">
        Questions per chapter
        {questions && ` · ${readyCount} of ${chapters.length} chapters have ${LOCKS_PER_GAME}+ approved questions`}
      </summary>

      <div className="space-y-4 px-5 pb-5">
        {loading && !questions && <p className="text-sm text-muted">Loading...</p>}
        {errorMessage && <p className="text-sm text-bad">{errorMessage}</p>}

        {questions && (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <select value={filters.course} onChange={(e) => setLevel('course', e.target.value)} aria-label="Course" className={selectClass}>
                <option value="">All courses</option>
                {courses.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <select value={filters.professor} onChange={(e) => setLevel('professor', e.target.value)} aria-label="Professor" className={selectClass}>
                <option value="">All professors</option>
                {professors.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} aria-label="Chapter status" className={selectClass}>
                <option value="all">All chapters</option>
                <option value="short">Fewer than {LOCKS_PER_GAME} questions</option>
                <option value="ready">Enough for a game</option>
              </select>
              <input
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Search chapters"
                aria-label="Search chapters"
                className={inputClass}
              />
            </div>

            <p className="text-xs text-muted">
              Showing {shown.length} of {chapters.length} chapters with approved questions. Every round gives each crew one
              secret term (an answer of 1 to 4 words, no numbers), so aim for at least {LOCKS_PER_GAME} per chapter.
            </p>

            {groups.length === 0 && (
              <p className="rounded-lg bg-panel p-4 text-center text-sm text-muted">No chapters match these filters.</p>
            )}

            {groups.map((group) => (
              <section key={group.key}>
                <h3 className="text-sm font-bold uppercase tracking-wider text-info">
                  {group.course} › {group.professor}
                </h3>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  {group.chapters.map((chapter) => <ChapterCard key={chapter.key} chapter={chapter} />)}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </details>
  )
}

// --- Editing a question: shared by the review queue and the question bank ---

function draftFromQuestion(question) {
  return {
    course_name: question.course_name,
    professor_name: question.professor_name,
    topic_name: question.topic_name,
    // Escape Room places a question by chapter only; any category and points are saved unchanged
    category_name: question.category_name ?? '',
    points: question.points,
    question_text: question.question_text,
    open_answer: question.answer_text ?? '',
    accepted_answers: [...(question.accepted_answers ?? [])],
    image_path: question.image_path ?? null,
  }
}

// A draft as the game preview shows it
function previewFromDraft(draft) {
  return {
    question_text: draft.question_text,
    image_path: draft.image_path,
    choices: [],
    answer_text: draft.open_answer,
    accepted_answers: cleanAlternatives(draft.accepted_answers),
  }
}

const cleanAlternatives = (list = []) => list.map((a) => a.trim()).filter(Boolean)

// What the server needs to save a draft (Escape Room questions are always open response)
function draftPayload(draft) {
  return {
    course_name: draft.course_name,
    professor_name: draft.professor_name,
    topic_name: draft.topic_name,
    category_name: draft.category_name,
    points: draft.points,
    question_text: draft.question_text,
    question_type: 'open_response',
    choices: [],
    answer_text: draft.open_answer.trim(),
    accepted_answers: cleanAlternatives(draft.accepted_answers),
    image_path: draft.image_path,
  }
}

// The approved professor/chapter a draft points at (missing = it would be new)
function findPlacement(catalog, draft) {
  const professors = catalog.find((c) => c.course_name === draft.course_name)?.professors ?? []
  const professor = professors.find((p) => same(p.professor_name, draft.professor_name))
  const topic = professor?.topics.find((t) => same(t.topic_name, draft.topic_name))
  return { professors, professor, topic }
}

// Course, professor and chapter; flags names that don't exist yet
function PlacementFields({ draft, set, catalog, idPrefix }) {
  const { professors, professor, topic } = findPlacement(catalog, draft)

  function setLevel(key, value) {
    const descendants = {
      course_name: ['professor_name', 'topic_name'],
      professor_name: ['topic_name'],
    }[key] ?? []
    // A new course starts on the shared lab set, like the submit form
    const reset = Object.fromEntries(descendants.map((field) => [field, field === 'professor_name' ? LAB_PROFESSOR : '']))
    set({ ...reset, [key]: value })
  }

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <select
        value={draft.course_name}
        onChange={(event) => setLevel('course_name', event.target.value)}
        aria-label="Course"
        className={inputClass}
      >
        <CourseOptions catalog={catalog} current={draft.course_name} />
      </select>

      <NamedField
        key={`professor-${idPrefix}-${draft.course_name}`}
        label="Professor"
        value={draft.professor_name}
        onChange={(value) => setLevel('professor_name', value)}
        options={professors.map((p) => p.professor_name)}
        isNew={!professor}
      />
      <NamedField
        key={`topic-${idPrefix}-${draft.course_name}-${draft.professor_name}`}
        label="Chapter"
        value={draft.topic_name}
        onChange={(value) => setLevel('topic_name', value)}
        options={professor?.topics.map((t) => t.topic_name) ?? []}
        isNew={!topic}
      />
    </div>
  )
}

// Upload button for a question's picture (used when it has none, or after removing one)
function AddPicture({ onAdded }) {
  const [uploading, setUploading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function upload(file) {
    if (!file) return
    setUploading(true)
    setErrorMessage('')

    try {
      onAdded(await uploadQuestionImage(file))
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <label
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-sm text-muted hover:bg-hover ${
          uploading ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => {
            upload(event.target.files?.[0])
            event.target.value = ''
          }}
          className="hidden"
        />
        {uploading ? 'Uploading picture...' : '🖼️ Add a picture'}
      </label>
      {errorMessage && <p className="mt-1 text-xs text-bad">{errorMessage}</p>}
    </div>
  )
}

// Question text, picture (add, keep or remove) and the answer key (model answer + alternatives)
function ContentFields({ draft, set, originalImage }) {
  return (
    <>
      <textarea
        value={draft.question_text}
        onChange={(event) => set({ question_text: event.target.value })}
        rows={2}
        aria-label="Question"
        className={inputClass}
      />

      {draft.image_path && (
        <div className="space-y-1">
          <QuestionImage path={draft.image_path} className="max-h-56" />
          <button
            type="button"
            onClick={() => set({ image_path: null })}
            className="block w-full text-center text-xs font-bold text-bad hover:brightness-125"
          >
            Remove picture
          </button>
        </div>
      )}
      {!draft.image_path && <AddPicture onAdded={(path) => set({ image_path: path })} />}
      {!draft.image_path && originalImage && (
        <button
          type="button"
          onClick={() => set({ image_path: originalImage })}
          className="text-xs font-bold text-info hover:brightness-125"
        >
          Undo: put the picture back
        </button>
      )}

      <OpenAnswerField
        value={draft.open_answer}
        onChange={(value) => set({ open_answer: value })}
        alternatives={draft.accepted_answers}
        onAlternativesChange={(list) => set({ accepted_answers: list })}
        inputClassName="text-sm"
      />
    </>
  )
}

function QuestionEditor({ question, catalog, busy, onSave, onCancel }) {
  const [draft, setDraft] = useState(() => draftFromQuestion(question))
  const set = (changes) => setDraft((current) => ({ ...current, ...changes }))

  function submit(event) {
    event.preventDefault()
    onSave('edit_question', draft)
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-lg border border-info bg-card p-3">
      <p className="text-xs text-muted">
        Save changes to this {question.status === 'rejected' ? 'retired' : 'approved'} question, or save the edited
        version as a new approved question.
      </p>
      <PlacementFields draft={draft} set={set} catalog={catalog} idPrefix={`bank-${question.id}`} />
      <ContentFields draft={draft} set={set} originalImage={question.image_path} />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-ok px-4 py-2 text-xs font-bold text-on-accent hover:brightness-110 disabled:opacity-50"
        >
          {busy ? 'Saving...' : 'Save changes'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onSave('copy_question', draft)}
          className="rounded-lg bg-info px-4 py-2 text-xs font-bold text-on-accent hover:brightness-110 disabled:opacity-50"
        >
          Save as approved copy
        </button>
        <GamePreviewButton question={previewFromDraft(draft)} />
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-lg border border-line px-4 py-2 text-xs font-bold text-ink hover:bg-hover disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function PendingQuestion({ question, catalog, onDone }) {
  const [draft, setDraft] = useState(() => draftFromQuestion(question))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const set = (changes) => setDraft((current) => ({ ...current, ...changes }))

  // The chapter's approved questions, to check this one isn't a repeat
  const [showChapter, setShowChapter] = useState(false)

  async function run(payload, fallback) {
    setBusy(true)
    setErrorMessage('')

    try {
      await review(payload, fallback)
      await onDone()
    } catch (error) {
      setErrorMessage(error.message)
      setBusy(false)
    }
  }

  // The question as the reviewer has edited it
  const editedQuestion = {
    question_text: draft.question_text,
    question_type: 'open_response',
    choices: [],
    answer_text: draft.open_answer.trim(),
    accepted_answers: cleanAlternatives(draft.accepted_answers),
    image_path: draft.image_path,
  }

  function decide(action) {
    return run(
      action === 'approve'
        ? { action, question_id: question.id, ...draftPayload(draft), review_note: note }
        : { action, question_id: question.id, review_note: note },
      `Could not ${action} this question.`
    )
  }

  // Choosing between this submission and a similar question already in the bank
  function resolveDuplicate(match, keep) {
    if (keep === 'existing') {
      return run(
        { action: 'reject', question_id: question.id, review_note: `Duplicate of: "${match.question_text}"` },
        'Could not reject this question.'
      )
    }

    if (keep === 'new' && match.status === 'approved') {
      return run(
        { action: 'replace_existing', question_id: question.id, replaces_id: match.id, ...editedQuestion },
        'Could not replace that question.'
      )
    }

    // Both pending: drop the other one; this one stays here for normal approval
    return run(
      { action: 'reject', question_id: match.id, review_note: `Duplicate of: "${question.question_text}"` },
      'Could not reject the other question.'
    )
  }

  return (
    <article className="space-y-3 rounded-xl border border-line bg-card p-5">
      <PlacementFields draft={draft} set={set} catalog={catalog} idPrefix={question.id} />

      {draft.course_name && draft.professor_name.trim() && draft.topic_name.trim() && (
        <div className="rounded-lg bg-panel p-2 text-xs text-muted">
          <button
            type="button"
            onClick={() => setShowChapter((open) => !open)}
            className="font-bold text-info hover:brightness-125"
          >
            {showChapter ? 'Hide' : 'See'} this chapter&apos;s approved questions
          </button>
          {showChapter && (
            <div className="mt-2">
              <BankResults
                catalog={catalog}
                filters={{
                  course_name: draft.course_name,
                  professor_name: draft.professor_name,
                  topic_name: draft.topic_name,
                  status: 'approved',
                }}
                compact
              />
            </div>
          )}
        </div>
      )}

      <ContentFields draft={draft} set={set} originalImage={question.image_path} />

      {question.similar?.map((match) => (
        <DuplicateCompare
          key={match.id}
          edited={editedQuestion}
          match={match}
          busy={busy}
          onKeep={(keep) => resolveDuplicate(match, keep)}
        />
      ))}

      <p className="text-xs text-muted">
        Submitted by {question.submitter_name || 'anonymous'}
        {question.submitted_at && ` on ${new Date(question.submitted_at).toLocaleDateString()}`}
      </p>
      {question.submitter_note && (
        <p className="rounded-md bg-panel px-2 py-1 text-xs text-ink">
          <span className="font-bold text-info">Leader&apos;s note:</span> {question.submitter_note}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <GamePreviewButton question={previewFromDraft(draft)} className="py-2" />
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Review note (optional)"
          maxLength={500}
          className={`${inputClass} min-w-48 flex-1`}
        />
        <button
          onClick={() => decide('approve')}
          disabled={busy}
          className="rounded-lg bg-ok px-5 py-2 font-bold text-on-accent hover:brightness-110 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => decide('reject')}
          disabled={busy}
          className="rounded-lg border border-bad px-5 py-2 font-bold text-bad hover:bg-bad-soft disabled:opacity-50"
        >
          Reject
        </button>
      </div>

      {errorMessage && <p className="text-sm text-bad">{errorMessage}</p>}
    </article>
  )
}

// Side-by-side view of a submission and a similar question, so the reviewer keeps the clearer one
function DuplicateCompare({ edited, match, busy, onKeep }) {
  const isApproved = match.status === 'approved'

  return (
    <div className="rounded-lg border border-accent bg-warn-soft p-3 text-sm">
      <p className="font-bold text-accent">
        ⚠️ Possible duplicate ({Math.round(match.score * 100)}% similar). Which version is clearer?
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <QuestionPreview
          title="This submission"
          subtitle="Includes your edits above"
          question={edited}
        />
        <QuestionPreview
          title={isApproved ? 'Already in the game' : 'Also waiting for review'}
          subtitle={`${match.course_name} › ${match.professor_name} › ${match.topic_name}`}
          question={match}
        />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          onClick={() => onKeep('new')}
          disabled={busy}
          className="rounded-lg bg-info px-4 py-2 font-bold text-on-accent hover:brightness-110 disabled:opacity-50"
        >
          {isApproved ? 'Use this wording instead' : 'Keep this one'}
        </button>
        <button
          onClick={() => onKeep('existing')}
          disabled={busy}
          className="rounded-lg border border-info px-4 py-2 font-bold text-info hover:bg-hover disabled:opacity-50"
        >
          {isApproved ? 'Keep the existing one' : 'Keep the other one'}
        </button>
      </div>

      <p className="mt-2 text-xs text-muted">
        {isApproved
          ? 'Using this wording puts it in the existing question’s spot and retires the old one. Keeping the existing one rejects this submission as a duplicate.'
          : 'The one you don’t keep is rejected as a duplicate; the one you keep stays in the queue to approve.'}
        {' '}Not a duplicate? Just approve or reject below as usual.
      </p>
    </div>
  )
}

function QuestionPreview({ title, subtitle, question }) {
  return (
    <div className="rounded-lg bg-panel p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-info">{title}</p>
      <p className="text-[11px] text-muted">{subtitle}</p>
      <p className="mt-2 font-bold text-ink">{question.question_text}</p>
      {question.image_path && <QuestionImage path={question.image_path} className="mt-2 max-h-40" />}
      <AnswerKey question={question} className="mt-2" />
    </div>
  )
}

// "Answer: … ✓ (also: …)"
function AnswerKey({ question, className = '' }) {
  return (
    <p className={`font-bold text-ok ${className}`}>
      Answer: {question.answer_text} ✓
      {question.accepted_answers?.length > 0 && (
        <span className="font-normal text-ok"> (also: {question.accepted_answers.join(', ')})</span>
      )}
    </p>
  )
}

const ADD_NEW = '__add_new__'

function NamedField({ label, value, onChange, options, isNew }) {
  const [adding, setAdding] = useState(null)
  const isAdding = options.length === 0 || (adding ?? isNew)

  if (isAdding) {
    return (
      <div>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
          placeholder={label}
          required
          className={`${inputClass} ${isNew ? 'border-accent' : ''}`}
        />
        <span className="mt-0.5 flex justify-between text-[10px] font-bold uppercase text-accent">
          <span>New {label.toLowerCase()}</span>
          {options.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setAdding(false)
                onChange('')
              }}
              className="text-info hover:brightness-125"
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
          setAdding(false)
          onChange(event.target.value)
        }
      }}
      aria-label={label}
      required
      className={inputClass}
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

const STATUS_LABELS = { approved: 'Approved (in rotation)', pending: 'Waiting for review', rejected: 'Retired / rejected' }

// Browse every open-response question by course > professor > chapter (Escape Room places a question by
// its chapter only)
function QuestionBank() {
  const [catalog, setCatalog] = useState([])
  const [filters, setFilters] = useState({
    course_name: '',
    professor_name: '',
    topic_name: '',
    status: 'approved',
  })

  useEffect(() => {
    callFunction('submit-questions', { action: 'catalog' }, 'Could not load courses.')
      .then((data) => setCatalog(data.courses || []))
      .catch(() => setCatalog([]))
  }, [])

  const professors = catalog.find((c) => c.course_name === filters.course_name)?.professors ?? []
  const topics = professors.find((p) => p.professor_name === filters.professor_name)?.topics ?? []

  // Changing a level clears the levels under it
  function setLevel(key, value) {
    const order = ['course_name', 'professor_name', 'topic_name']
    const cleared = Object.fromEntries(order.slice(order.indexOf(key) + 1).map((k) => [k, '']))
    setFilters((current) => ({ ...current, ...cleared, [key]: value }))
  }

  const selectClass = `${inputClass} disabled:opacity-50`

  return (
    <div className="space-y-4">
      <section className="grid gap-2 rounded-xl border border-line bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <select value={filters.course_name} onChange={(e) => setLevel('course_name', e.target.value)} aria-label="Course" className={selectClass}>
          <option value="">All courses</option>
          <CourseOptions catalog={catalog} />
        </select>

        <select value={filters.professor_name} onChange={(e) => setLevel('professor_name', e.target.value)} disabled={!filters.course_name} aria-label="Professor" className={selectClass}>
          <option value="">All professors</option>
          {professors.map((p) => <option key={p.professor_name} value={p.professor_name}>{p.professor_name}</option>)}
        </select>

        <select value={filters.topic_name} onChange={(e) => setLevel('topic_name', e.target.value)} disabled={!filters.professor_name} aria-label="Chapter" className={selectClass}>
          <option value="">All chapters</option>
          {topics.map((t) => <option key={t.topic_name} value={t.topic_name}>{t.topic_name}</option>)}
        </select>

        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} aria-label="Status" className={selectClass}>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </section>

      <BankResults filters={filters} catalog={catalog} />
    </div>
  )
}

// Questions matching the filters, grouped by chapter (a game asks from one chapter)
function BankResults({ filters, catalog = [], compact = false }) {
  const [questions, setQuestions] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const filterKey = JSON.stringify(filters)

  async function load() {
    try {
      const data = await review({ action: 'list_bank', ...filters }, 'Could not load the question bank.')
      setQuestions(data.questions || [])
      setErrorMessage('')
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  useEffect(() => {
    load()
    // Reload whenever any filter changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey])

  async function change(action, question) {
    if (action === 'retire_question' && !window.confirm('Retire this question? Games will stop using it, but it stays in the history.')) {
      return
    }

    if (
      action === 'delete_question' &&
      !window.confirm(
        `Permanently delete this question${question.image_path ? ' and its picture' : ''}?\n\n"${question.question_text}"\n\nThis can't be undone.`
      )
    ) {
      return
    }

    setMessage('')
    setErrorMessage('')
    try {
      const data = await review({ action, question_id: question.id }, 'Could not update that question.')
      setMessage(data.message)
      await load()
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  async function saveQuestion(action, question, draft) {
    setBusyId(question.id)
    setMessage('')
    setErrorMessage('')

    try {
      const data = await review(
        { action, question_id: question.id, ...draftPayload(draft) },
        action === 'edit_question' ? 'Could not save that edit.' : 'Could not copy that question.'
      )
      setMessage(data.message)
      setEditingId(null)
      await load()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setBusyId(null)
    }
  }

  if (errorMessage && !questions) return <p className="text-sm text-bad">{errorMessage}</p>
  if (!questions) return <p className="text-sm text-muted">Loading...</p>
  if (questions.length === 0) {
    return (
      <div className="space-y-2">
        {errorMessage && <p className="text-sm text-bad">{errorMessage}</p>}
        <p className="text-sm text-muted">No questions match these filters.</p>
      </div>
    )
  }

  // Group by chapter, the pool a game picks from
  const slots = []
  for (const question of questions) {
    const key = [question.course_name, question.professor_name, question.topic_name].join('|')
    let slot = slots.find((s) => s.key === key)
    if (!slot) {
      slot = { key, question, items: [] }
      slots.push(slot)
    }
    slot.items.push(question)
  }

  return (
    <div className="space-y-4">
      {errorMessage && <p className="text-sm text-bad">{errorMessage}</p>}
      {!compact && (
        <p className="text-sm text-muted">
          {questions.length} question{questions.length === 1 ? '' : 's'} in {slots.length} chapter{slots.length === 1 ? '' : 's'}.
          {filters.status === 'approved' && ' A game draws its secret terms at random from the chosen chapters (answers of 1 to 4 words, no numbers).'}
        </p>
      )}
      {message && <p className="text-sm text-ok">{message}</p>}

      {slots.map(({ key, question: first, items }) => (
        <section key={key} className="space-y-2">
          {!compact && (
            <h3 className="text-xs font-bold uppercase tracking-wider text-info">
              {first.course_name} › {first.professor_name} › {first.topic_name} · {items.length} in bank
            </h3>
          )}

          <div className={compact ? 'space-y-2' : 'grid gap-2 md:grid-cols-2'}>
            {items.map((question) => (
              <article
                key={question.id}
                className={`rounded-lg border border-line bg-panel p-3 text-sm ${
                  !compact && editingId === question.id ? 'md:col-span-2' : ''
                }`}
              >
                <p className="font-bold text-ink">{question.question_text}</p>
                {question.image_path && <QuestionImage path={question.image_path} className="mt-2 max-h-40" />}
                <AnswerKey question={question} className="mt-1" />
                <p className="mt-2 text-[11px] text-muted">
                  By {question.submitter_name || 'starter set'}
                  {question.reviewed_by && ` · reviewed by ${question.reviewed_by}`}
                </p>
                {question.submitter_note && (
                  <p className="mt-1 text-[11px] text-ink">
                    <span className="font-bold text-info">Leader&apos;s note:</span> {question.submitter_note}
                  </p>
                )}
                {question.review_note && (
                  <p className="mt-1 text-[11px] text-ink">
                    <span className="font-bold text-accent">Reviewer&apos;s note:</span> {question.review_note}
                  </p>
                )}
                {editingId !== question.id && (
                  <GamePreviewButton question={question} className="mt-2" />
                )}
                {!compact &&
                  (question.status === 'approved' || question.status === 'rejected') &&
                  editingId === question.id && (
                    <QuestionEditor
                      question={question}
                      catalog={catalog}
                      busy={busyId === question.id}
                      onSave={(action, draft) => saveQuestion(action, question, draft)}
                      onCancel={() => setEditingId(null)}
                    />
                )}
                {!compact && (question.status === 'approved' || question.status === 'rejected') && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                    {editingId !== question.id && (
                      <button
                        type="button"
                        onClick={() => setEditingId(question.id)}
                        className="text-xs font-bold text-info hover:brightness-125"
                      >
                        Edit / copy
                      </button>
                    )}
                    {question.status === 'approved' && (
                      <button
                        type="button"
                        onClick={() => change('retire_question', question)}
                        className="text-xs font-bold text-bad hover:brightness-125"
                      >
                        Retire
                      </button>
                    )}
                  </div>
                )}
                {!compact && question.status === 'rejected' && (
                  <div className="mt-2 flex gap-4">
                    <button onClick={() => change('restore_question', question)} className="text-xs font-bold text-ok hover:brightness-125">
                      Restore to bank
                    </button>
                    <button onClick={() => change('delete_question', question)} className="text-xs font-bold text-bad hover:brightness-125">
                      🗑️ Delete permanently
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function ReviewerManager({ myEmail }) {
  const [reviewers, setReviewers] = useState([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('co_mentor')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  async function load() {
    try {
      const data = await review({ action: 'list_reviewers' }, 'Could not load reviewers.')
      setReviewers(data.reviewers || [])
    } catch (error) {
      setErrorMessage(error.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function run(payload) {
    setMessage('')
    setErrorMessage('')

    try {
      const data = await review(payload, 'Something went wrong.')
      setMessage(data.message)
      await load()
      return true
    } catch (error) {
      setErrorMessage(error.message)
      return false
    }
  }

  async function addReviewer(event) {
    event.preventDefault()

    if (await run({ action: 'add_reviewer', email, role })) {
      setEmail('')
      setRole('co_mentor')
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addReviewer} className="space-y-3 rounded-xl border border-line bg-card p-5">
        <h2 className="font-bold text-accent">Add a reviewer</h2>
        <p className="text-sm text-muted">
          They sign in at this page with that email. Update the list each semester as mentors change.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="mentor@utrgv.edu"
            required
            className={`${inputClass} min-w-56 flex-1`}
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            aria-label="Role"
            className={`${inputClass} w-auto`}
          >
            <option value="co_mentor">Co-mentor</option>
            <option value="supervisor">Supervisor</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-accent px-5 py-2 font-bold text-on-accent hover:opacity-90"
          >
            Add
          </button>
        </div>
        {message && <p className="text-sm text-ok">{message}</p>}
        {errorMessage && <p className="text-sm text-bad">{errorMessage}</p>}
      </form>

      <section className="rounded-xl border border-line bg-card p-5">
        <h2 className="font-bold text-accent">Current reviewers ({reviewers.length})</h2>
        <ul className="mt-3 space-y-2">
          {reviewers.map((reviewer) => (
            <li
              key={reviewer.email}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-panel px-3 py-2 text-sm"
            >
              <span>
                <span className="font-bold">{reviewer.email}</span>
                <span className="ml-2 text-xs uppercase text-info">
                  {reviewer.role === 'supervisor' ? 'Supervisor' : 'Co-mentor'}
                </span>
              </span>
              {reviewer.email !== myEmail && (
                <button
                  onClick={() => {
                    if (window.confirm(`Remove ${reviewer.email} as a reviewer?`)) {
                      run({ action: 'remove_reviewer', email: reviewer.email })
                    }
                  }}
                  className="text-xs font-bold text-bad hover:brightness-125"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

// Approved questions a leader flagged after a game. Editing the question resolves the flag.
function FlaggedQuestions({ catalog }) {
  const [flags, setFlags] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const load = () =>
    review({ action: 'list_flags' }, 'Could not load flagged questions.')
      .then((data) => setFlags(data.flags || []))
      .catch((error) => setErrorMessage(error.message))

  useEffect(() => {
    review({ action: 'list_flags' }, 'Could not load flagged questions.')
      .then((data) => setFlags(data.flags || []))
      .catch((error) => setErrorMessage(error.message))
  }, [])

  if (errorMessage) return <p className="text-sm text-bad">{errorMessage}</p>
  if (!flags || flags.length === 0) return null

  return (
    <section className="space-y-3 rounded-xl border-2 border-bad bg-bad-soft p-4">
      <h2 className="font-black uppercase tracking-wider text-bad">
        ⚠️ Approved question needs revision ({flags.length})
      </h2>
      {flags.map((flag) => <FlagCard key={flag.id} flag={flag} catalog={catalog} onDone={load} />)}
    </section>
  )
}

function FlagCard({ flag, catalog, onDone }) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const question = flag.question
  const reason = FLAG_REASONS.find((r) => r.value === flag.reason)?.label ?? flag.reason

  async function run(steps) {
    setBusy(true)
    setErrorMessage('')
    try {
      for (const [payload, fallback] of steps) await review(payload, fallback)
      setEditing(false)
      await onDone()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  const resolve = (note) => [{ action: 'resolve_flag', flag_id: flag.id, note }, 'Could not resolve that.']

  return (
    <article className="space-y-3 rounded-lg border border-bad bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="rounded-md bg-bad px-2 py-0.5 text-xs font-black uppercase text-on-accent">{reason}</span>
        <span className="text-xs text-muted">
          Flagged by {flag.flagged_by || 'a leader'} · {new Date(flag.created_at).toLocaleDateString()}
        </span>
      </div>
      <p className="rounded-md bg-panel px-3 py-2 text-sm text-ink">
        <span className="font-bold text-accent">Leader&apos;s note:</span> {flag.note}
      </p>

      <QuestionPreview
        title={question.status === 'approved' ? 'Approved' : 'Retired'}
        subtitle={`${question.course_name} › ${question.professor_name} › ${question.topic_name}`}
        question={question}
      />

      {editing ? (
        <QuestionEditor
          question={question}
          catalog={catalog}
          busy={busy}
          onSave={(action, draft) =>
            run([
              [{ action, question_id: question.id, ...draftPayload(draft) }, 'Could not save that edit.'],
              resolve(action === 'copy_question' ? 'Saved an edited copy.' : 'Question edited.'),
            ])
          }
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={busy}
            className="rounded-lg bg-info px-4 py-2 text-sm font-bold text-on-accent hover:brightness-110 disabled:opacity-50"
          >
            Edit question
          </button>
          <button
            type="button"
            onClick={() => run([resolve('No change needed.')])}
            disabled={busy}
            className="rounded-lg border border-ok px-4 py-2 text-sm font-bold text-ok hover:bg-hover disabled:opacity-50"
          >
            Mark resolved (no change)
          </button>
          {question.status === 'approved' && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Retire this question? Games will stop using it, but it stays in the history.')) {
                  run([
                    [{ action: 'retire_question', question_id: question.id, review_note: `Retired after a leader flagged it: ${flag.note}` }, 'Could not retire that question.'],
                    resolve('Question retired.'),
                  ])
                }
              }}
              disabled={busy}
              className="rounded-lg border border-bad px-4 py-2 text-sm font-bold text-bad hover:bg-bad-soft disabled:opacity-50"
            >
              Retire question
            </button>
          )}
          <GamePreviewButton question={question} className="py-2" />
        </div>
      )}

      {errorMessage && <p className="text-sm text-bad">{errorMessage}</p>}
    </article>
  )
}
