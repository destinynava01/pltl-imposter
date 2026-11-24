import { useCallback, useEffect, useState } from 'react'
import { callFunction } from './api'

// The "Subjects & Courses" tab of the review page, in the review page's style.
// Any reviewer can add subjects (Chemistry) and courses under them (General Chemistry 1). A new subject starts out
// for Escape Room only. Only the creator sees the "Share with" tags and settings, which share a subject's approved
// questions with other games. Courses and subjects can only be removed while nothing is filed under them.

// Games that share the database; the creator tags each subject with the ones that may use its questions
const GAMES = [
  { id: 'jeopardy', label: 'Jeopardy' },
  { id: 'monopoly', label: 'Monopoly' },
  { id: 'escape_room', label: 'Escape Room' },
]

const inputClass =
  'w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink placeholder-muted'

const review = (payload, fallback = 'Something went wrong.') => callFunction('review', payload, fallback)

export default function SubjectManager({ isCreator }) {
  const [subjects, setSubjects] = useState(null)
  const [newSubject, setNewSubject] = useState('')
  const [newCourses, setNewCourses] = useState({})
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const load = useCallback(
    () =>
      review({ action: 'list_subjects' }, 'Could not load subjects.')
        .then((data) => setSubjects(data.subjects || []))
        .catch((error) => setErrorMessage(error.message)),
    [],
  )

  useEffect(() => {
    load()
  }, [load])

  async function run(payload) {
    setMessage('')
    setErrorMessage('')

    try {
      const data = await review(payload)
      setMessage(data.message)
      await load()
      return true
    } catch (error) {
      setErrorMessage(error.message)
      return false
    }
  }

  async function addSubject(event) {
    event.preventDefault()
    if (await run({ action: 'add_subject', subject_name: newSubject })) setNewSubject('')
  }

  async function addCourse(event, subjectName) {
    event.preventDefault()
    if (await run({ action: 'add_course', subject_name: subjectName, course_name: newCourses[subjectName] ?? '' })) {
      setNewCourses((current) => ({ ...current, [subjectName]: '' }))
    }
  }

  // Creator only: tick or untick a game for a subject
  function toggleGame(subject, gameId) {
    const has = subject.games.includes(gameId)
    const next = has ? subject.games.filter((id) => id !== gameId) : [...subject.games, gameId]

    if (next.length === 0) {
      setMessage('')
      setErrorMessage('A subject needs at least one game.')
      return
    }
    if (has && !window.confirm(`Hide ${subject.subject_name} from ${GAMES.find((g) => g.id === gameId)?.label}?`)) return

    run({ action: 'set_subject_options', subject_name: subject.subject_name, games: next })
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addSubject} className="space-y-3 rounded-xl border border-line bg-card p-5">
        <h2 className="font-bold text-accent">Add a subject</h2>
        <p className="text-sm text-muted">
          For example Chemistry. It starts out for Escape Room only. Then add its courses below; they show up in the
          submission form, the review tools, and the game lobby.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={newSubject}
            onChange={(event) => setNewSubject(event.target.value)}
            placeholder="Subject name"
            maxLength={60}
            required
            className={`${inputClass} min-w-56 flex-1`}
          />
          <button type="submit" className="rounded-lg bg-accent px-5 py-2 font-bold text-on-accent hover:opacity-90">
            Add subject
          </button>
        </div>
      </form>

      {message && <p className="text-sm text-ok">{message}</p>}
      {errorMessage && <p className="text-sm text-bad">{errorMessage}</p>}

      {!subjects ? (
        <p className="text-center text-muted">Loading subjects...</p>
      ) : (
        subjects.map((subject) => (
          <section key={subject.subject_name} className="rounded-xl border border-line bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-accent">{subject.subject_name}</h2>
              {subject.courses.length === 0 && (
                <button
                  onClick={() => {
                    if (window.confirm(`Remove the subject ${subject.subject_name}?`)) {
                      run({ action: 'remove_subject', subject_name: subject.subject_name })
                    }
                  }}
                  className="text-xs font-bold text-bad hover:brightness-125"
                >
                  Remove subject
                </button>
              )}
            </div>

            {isCreator && subject.games && (
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-info">Share with</span>
                {GAMES.map((game) => (
                  <label key={game.id} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={subject.games.includes(game.id)}
                      // A subject that isn't transferable stays with its one game
                      disabled={!subject.transferable && !subject.games.includes(game.id)}
                      onChange={() => toggleGame(subject, game.id)}
                      className="accent-accent"
                    />
                    {game.label}
                  </label>
                ))}
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={subject.transferable}
                    onChange={() =>
                      run({ action: 'set_subject_options', subject_name: subject.subject_name, transferable: !subject.transferable })
                    }
                    className="accent-accent"
                  />
                  Transferable between games
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={subject.shared_curriculum}
                    onChange={() =>
                      run({
                        action: 'set_subject_options',
                        subject_name: subject.subject_name,
                        shared_curriculum: !subject.shared_curriculum,
                      })
                    }
                    className="accent-accent"
                  />
                  Shared curriculum (no professors)
                </label>
              </div>
            )}

            <ul className="mt-3 space-y-2">
              {subject.courses.length === 0 && <li className="text-sm text-muted">No courses yet.</li>}
              {subject.courses.map((course) => (
                <li
                  key={course.course_name}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-panel px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-bold">{course.course_name}</span>
                    <span className="ml-2 text-xs text-info">
                      {course.set_count === 0
                        ? 'No questions yet'
                        : `${course.set_count} question set${course.set_count === 1 ? '' : 's'}`}
                    </span>
                  </span>
                  {course.set_count === 0 && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Remove the course ${course.course_name}?`)) {
                          run({ action: 'remove_course', course_name: course.course_name })
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

            <form onSubmit={(event) => addCourse(event, subject.subject_name)} className="mt-3 flex flex-wrap gap-2">
              <input
                value={newCourses[subject.subject_name] ?? ''}
                onChange={(event) => setNewCourses((current) => ({ ...current, [subject.subject_name]: event.target.value }))}
                placeholder={`New ${subject.subject_name} course`}
                maxLength={60}
                required
                aria-label={`New course in ${subject.subject_name}`}
                className={`${inputClass} min-w-56 flex-1`}
              />
              <button
                type="submit"
                className="rounded-lg border border-accent px-4 py-2 font-bold text-accent hover:bg-hover"
              >
                Add course
              </button>
            </form>
          </section>
        ))
      )}
    </div>
  )
}
