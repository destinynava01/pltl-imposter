import { useState } from 'react'

const choice = (on) =>
  `rounded-lg border-2 px-3 py-2 text-sm font-bold transition ${
    on ? 'border-info bg-info-soft text-info box-glow-info' : 'border-line bg-panel text-ink hover:bg-hover'
  }`

// Subject > course > professor > chapter, from the places list (imp-prompts "places"). Calls onPick(topicId).
// Shared-curriculum courses skip the professor step.
export default function ChapterPicker({ courses, value, onPick, counts = true }) {
  const [subject, setSubject] = useState('')
  const [courseName, setCourseName] = useState('')
  const [professorName, setProfessorName] = useState('')

  const subjects = [...new Set(courses.map((c) => c.subject_name))]
  const shown = courses.filter((c) => c.subject_name === subject)
  const course = shown.find((c) => c.course_name === courseName)
  const professors = course?.professors ?? []
  const pickProfessor = Boolean(course) && !course.shared_curriculum && professors.length > 1
  const professor = course ? (pickProfessor ? professors.find((p) => p.professor_name === professorName) : professors[0]) : null

  return (
    <div className="space-y-4">
      <div>
        <p className="font-bold text-accent">Subject</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {subjects.map((name) => (
            <button key={name} type="button" className={choice(subject === name)}
              onClick={() => { setSubject(name); setCourseName(''); setProfessorName(''); onPick('') }}>
              {name}
            </button>
          ))}
        </div>
      </div>

      {subject && (
        <div>
          <p className="font-bold text-accent">Course</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {shown.map((c) => (
              <button key={c.course_name} type="button" className={choice(courseName === c.course_name)}
                onClick={() => { setCourseName(c.course_name); setProfessorName(''); onPick('') }}>
                {c.course_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {pickProfessor && (
        <div>
          <p className="font-bold text-accent">Professor</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {professors.map((p) => (
              <button key={p.professor_name} type="button" className={choice(professorName === p.professor_name)}
                onClick={() => { setProfessorName(p.professor_name); onPick('') }}>
                {p.professor_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {professor && (
        <div>
          <p className="font-bold text-accent">Chapter</p>
          <div className="mt-2 grid gap-2">
            {professor.topics.map((t) => (
              <button key={t.id} type="button" className={`${choice(value === t.id)} flex items-center justify-between text-left`} onClick={() => onPick(t.id)}>
                <span>{t.topic_name}</span>
                {counts && <span className="text-xs font-normal text-muted">{t.approved} approved{t.pending ? ` · ${t.pending} waiting` : ''}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// A plain <select> of every chapter, grouped by course and professor (for moving a prompt in the review)
export function ChapterSelect({ courses, value, onChange, className = '' }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      {courses.flatMap((c) =>
        c.professors.map((p) => (
          <optgroup key={`${c.course_name}|${p.professor_name}`} label={c.shared_curriculum ? c.course_name : `${c.course_name} · ${p.professor_name}`}>
            {p.topics.map((t) => <option key={t.id} value={t.id}>{t.topic_name}</option>)}
          </optgroup>
        )),
      )}
    </select>
  )
}
