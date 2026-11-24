import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { impGame, watchGame } from './api'
import { DEFAULT_THINK, GROUP_COLORS, HUB_URL, MAX_GROUPS, MIN_GROUP_SIZE, MIN_GROUPS, SITE_NAME, THINK_CHOICES } from './config'
import { saveSession } from './session'
import { Button, Label } from './ui'

const card = 'rounded-xl border-2 border-line bg-card/90 p-6 shadow-lg backdrop-blur'
const field = 'w-full rounded-lg border-2 border-line bg-panel px-3 py-2 font-bold text-ink outline-none focus:outline-2 focus:outline-info'
const choice = (on) =>
  `rounded-lg border-2 px-3 py-2 text-sm font-bold transition ${
    on ? 'border-info bg-info-soft text-info box-glow-info' : 'border-line bg-panel text-ink hover:bg-hover'
  }`

// Leader lobby: create game -> groups -> finalize -> subject / course / professor / chapters -> think time and
// mode -> start. Students join from their phones; the leader approves them into groups.
export default function Lobby({ onStart, onOpenBoard, hasGame, resume, onCloseGame }) {
  const [catalog, setCatalog] = useState(null)
  const [catalogError, setCatalogError] = useState('')
  const [session, setSession] = useState(resume?.session ?? null)
  const [groupNames, setGroupNames] = useState(resume?.teams?.length ? resume.teams : ['Group 1', 'Group 2'])
  const [finalized, setFinalized] = useState(Boolean(resume?.finalized))
  const [subject, setSubject] = useState('')
  const [courseName, setCourseName] = useState('')
  const [professorName, setProfessorName] = useState('')
  const [pickedTopics, setPickedTopics] = useState([])
  const [thinkSeconds, setThinkSeconds] = useState(DEFAULT_THINK)
  const [hardMode, setHardMode] = useState(false)
  const [useMc, setUseMc] = useState(false) // also draw terms from multiple-choice answers
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [players, setPlayers] = useState([])

  useEffect(() => {
    impGame({ action: 'catalog' })
      .then((data) => setCatalog(data.courses))
      .catch((error) => setCatalogError(error.message))
  }, [])

  useEffect(() => {
    if (!session) return undefined
    const load = () =>
      impGame({ action: 'list_players', game_id: session.gameId, host_token: session.hostToken })
        .then((data) => setPlayers(data.players))
        .catch(() => {})
    load()
    return watchGame(session.gameId, ['lobby'], load, 10000)
  }, [session])

  const waiting = players.filter((p) => p.approval_status === 'pending')
  const groupLabel = (i) => groupNames[i].trim() || `Group ${i + 1}`

  async function finalizeGroups() {
    setBusy(true)
    setErrorMessage('')
    try {
      await impGame({
        action: 'set_teams', game_id: session.gameId, host_token: session.hostToken,
        team_names: groupNames.map((_, i) => groupLabel(i)),
      })
      setFinalized(true)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function studentAction(payload) {
    setBusy(true)
    setErrorMessage('')
    try {
      await impGame({ ...payload, game_id: session.gameId, host_token: session.hostToken })
      const data = await impGame({ action: 'list_players', game_id: session.gameId, host_token: session.hostToken })
      setPlayers(data.players)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  const playable = (catalog ?? []).filter((c) => c.professors.length > 0)
  const subjects = [...new Set(playable.map((c) => c.subject_name))]
  const courses = playable.filter((c) => c.subject_name === subject)
  const course = courses.find((c) => c.course_name === courseName)
  const professors = course?.professors ?? []
  const showProfessorStep = Boolean(course) && !course.shared_curriculum && professors.length > 1
  const professor = course ? (showProfessorStep ? professors.find((p) => p.professor_name === professorName) : professors[0]) : null
  const topics = professor?.topics ?? []

  function chooseSubject(name) {
    setSubject(name)
    setCourseName('')
    setProfessorName('')
    setPickedTopics([])
  }
  function chooseCourse(name) {
    setCourseName(name)
    setProfessorName('')
    setPickedTopics([])
  }
  const toggleTopic = (id) => setPickedTopics((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  async function createGame() {
    setBusy(true)
    setErrorMessage('')
    try {
      const data = await impGame({ action: 'create_game' })
      const created = { gameId: data.game.id, hostToken: data.host_token, joinCode: data.game.join_code }
      saveSession(created)
      setSession(created)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  async function start() {
    setBusy(true)
    setErrorMessage('')
    try {
      const data = await impGame({
        action: 'start_game',
        game_id: session.gameId,
        host_token: session.hostToken,
        course_name: course.course_name,
        professor_name: course.shared_curriculum ? '' : professor.professor_name,
        topic_ids: pickedTopics,
        team_names: groupNames.map((_, i) => groupLabel(i)),
        think_seconds: thinkSeconds,
        hard_mode: hardMode,
        use_mc: useMc,
      })
      if (data.round?.error) setErrorMessage(data.round.error)
      onStart(session)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  const termsIn = (t) => t.prompt_count + (useMc ? t.mc_count : 0)
  const termEstimate = topics.filter((t) => pickedTopics.includes(t.id)).reduce((n, t) => n + termsIn(t), 0)
  const joinUrl = session ? `${window.location.origin}/join?code=${session.joinCode}` : ''
  const sizes = groupNames.map((_, i) => players.filter((p) => p.approval_status === 'approved' && p.team_index === i).length)
  const smallGroups = sizes.filter((n) => n < MIN_GROUP_SIZE).length

  return (
    <main className="space-bg min-h-dvh p-4 text-ink sm:p-8">
      {hasGame && (
        <button onClick={onOpenBoard} className="fixed right-4 top-4 z-20 rounded-lg border-2 border-line bg-panel px-4 py-2 font-bold hover:bg-hover">
          Back to the game
        </button>
      )}

      <header className="mx-auto mb-8 max-w-5xl text-center">
        <p className="font-mono text-sm uppercase tracking-[0.3em] text-info">{SITE_NAME}</p>
        <h1 className="mt-2 font-display text-4xl uppercase tracking-wider text-accent glow-accent sm:text-5xl">Leader Lobby</h1>
        <p className="mt-3 text-muted">Sort your students into groups. Every group gets its own secret term each round.</p>
        <p className="mt-2 text-sm font-bold">
          <a href={HUB_URL} className="text-info hover:brightness-125">← All games</a>
          <span className="mx-2 text-muted">·</span>
          <a href="/submit" className="text-info hover:brightness-125">Submit questions</a>
          <span className="mx-2 text-muted">·</span>
          <a href="/review" className="text-info hover:brightness-125">Review queue</a>
        </p>

        <div className="mt-6">
          {session ? (
            <div className="flex flex-col items-center gap-3">
              <p className="font-bold text-ok">Game ready!</p>
              <Button
                variant="outline"
                className="!px-4 !py-2 text-sm"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('Close this game? Every student will be sent back to the join page.')) onCloseGame()
                }}
              >
                Close game and start fresh
              </Button>
            </div>
          ) : (
            <Button onClick={createGame} disabled={busy}>{busy ? 'Creating game…' : 'Create new game'}</Button>
          )}
          {errorMessage && <p className="mt-3 font-bold text-bad">{errorMessage}</p>}
        </div>
      </header>

      <section className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
        <div className={card}>
          <h2 className="font-display text-xl uppercase tracking-wider text-accent">Game information</h2>
          <p className="mt-4">
            Join code:{' '}
            {session
              ? <span className="font-mono text-3xl font-black tracking-widest text-info">{session.joinCode}</span>
              : <span className="text-muted">Not created yet</span>}
          </p>
          {session && (
            <div className="mt-6 flex flex-col items-center">
              <div className="rounded-xl border-2 border-info bg-white p-4 box-glow-info">
                <QRCodeSVG value={joinUrl} size={200} title={`Join code ${session.joinCode}`} />
              </div>
              <p className="mt-3 text-center text-sm text-muted">Students scan this with their phone camera to join.</p>
            </div>
          )}
          <div className="mt-6 rounded-lg border-2 border-dashed border-line p-4 text-sm text-muted">
            <p className="font-bold text-ink">How a round goes</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Phones show the group&apos;s secret term. The alien (the imposter) only sees the chapter.</li>
              <li>Thinking time, then students give one clue each, out loud, in the order on screen.</li>
              <li>The group votes on their phones. A caught imposter gets one guess at the term.</li>
            </ol>
          </div>
        </div>

        <div className={card}>
          <h2 className="font-display text-xl uppercase tracking-wider text-accent">Groups</h2>
          <div className="mt-4 space-y-3">
            {groupNames.map((name, i) => (
              // A group is a ship's crew pod: a colored light and the crew's name
              <div key={i} className="relative pt-3">
                <span
                  aria-hidden="true"
                  className="absolute left-4 top-0 h-4 w-24 rounded-t-md"
                  style={{ background: GROUP_COLORS[i] }}
                />
                <div className="holo relative flex items-center gap-3 rounded-lg px-4 py-3">
                  <span className="font-mono text-xs uppercase tracking-widest opacity-70">Pod {String(i + 1).padStart(2, '0')}</span>
                  <input
                    className="min-w-0 flex-1 rounded-md border border-line bg-panel px-3 py-1.5 font-mono text-lg font-bold text-ink outline-none focus:border-accent disabled:border-transparent disabled:bg-transparent disabled:px-0"
                    value={name}
                    maxLength={40}
                    disabled={finalized}
                    aria-label={`Name for group ${i + 1}`}
                    onChange={(e) => setGroupNames(groupNames.map((n, k) => (k === i ? e.target.value : n)))}
                  />
                  {finalized && <span className="font-mono text-xs opacity-70">{sizes[i]} in</span>}
                  {!finalized && groupNames.length > MIN_GROUPS && (
                    <button
                      type="button"
                      onClick={() => setGroupNames(groupNames.filter((_, k) => k !== i))}
                      aria-label={`Remove group ${i + 1}`}
                      className="rounded-md border border-line px-2.5 py-1 font-bold text-muted hover:bg-hover hover:text-ink"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!finalized && groupNames.length < MAX_GROUPS && (
            <Button variant="outline" className="mt-3 w-full" onClick={() => setGroupNames([...groupNames, `Group ${groupNames.length + 1}`])}>
              + Add group ({groupNames.length}/{MAX_GROUPS})
            </Button>
          )}
          <p className="mt-2 text-xs text-muted">Groups of 4 to 8 work best. A group needs at least {MIN_GROUP_SIZE} students to play.</p>

          <Button className="mt-4 w-full" disabled={!session || finalized || busy} onClick={finalizeGroups}>
            {finalized ? 'Groups finalized' : 'Finalize groups'}
          </Button>
          {finalized && (
            <button type="button" className="mt-2 text-sm font-bold text-info hover:brightness-125" onClick={() => setFinalized(false)}>
              Edit groups
            </button>
          )}

          {finalized && (
            <div className="mt-6 border-t-2 border-line pt-4">
              {catalogError && <p className="text-bad">{catalogError}</p>}
              {!catalog && !catalogError && <p className="text-muted">Loading subjects…</p>}
              {catalog && subjects.length === 0 && (
                <p className="text-muted">No chapters have terms yet. Add some on the Submit page, then approve them in the review queue.</p>
              )}

              {subjects.length > 0 && (
                <>
                  <Label>1. Subject</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {subjects.map((name) => (
                      <button key={name} type="button" aria-pressed={subject === name} onClick={() => chooseSubject(name)} className={choice(subject === name)}>
                        {name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {subject && (
                <>
                  <Label className="mt-4">2. Course</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {courses.map((c) => (
                      <button key={c.course_name} type="button" aria-pressed={courseName === c.course_name}
                        onClick={() => chooseCourse(c.course_name)} className={choice(courseName === c.course_name)}>
                        {c.course_name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {showProfessorStep && (
                <>
                  <Label className="mt-4">3. Professor</Label>
                  <select className={`${field} mt-2`} value={professorName} onChange={(e) => { setProfessorName(e.target.value); setPickedTopics([]) }}>
                    <option value="" disabled>Choose a professor</option>
                    {professors.map((p) => <option key={p.professor_name} value={p.professor_name}>{p.professor_name}</option>)}
                  </select>
                </>
              )}

              {professor && (
                <>
                  <div className="mt-4 flex items-baseline justify-between">
                    <Label>{showProfessorStep ? '4' : '3'}. Chapters</Label>
                    <span className="text-xs text-muted">{pickedTopics.length} selected</span>
                  </div>
                  <div className="mt-1 flex gap-3 text-xs font-bold">
                    <button type="button" className="text-info hover:brightness-125" onClick={() => setPickedTopics(topics.map((t) => t.id))}>Select all</button>
                    <button type="button" className="text-info hover:brightness-125" onClick={() => setPickedTopics([])}>Clear</button>
                  </div>
                  <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
                    {topics.map((t) => {
                      const on = pickedTopics.includes(t.id)
                      return (
                        <li key={t.id}>
                          <label className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 px-3 py-2 text-sm transition hover:bg-hover ${on ? 'border-info bg-info-soft' : 'border-line bg-panel'}`}>
                            <input type="checkbox" checked={on} onChange={() => toggleTopic(t.id)} className="h-4 w-4 accent-green-400" />
                            <span className="flex-1 font-bold">{t.topic_name}</span>
                            <span className={`text-xs ${termsIn(t) === 0 ? 'text-warn' : 'text-muted'}`}>
                              {t.prompt_count} term{t.prompt_count === 1 ? '' : 's'}{useMc && t.mc_count > 0 ? ` + ${t.mc_count} MC` : ''}
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                  {pickedTopics.length > 0 && (
                    <p className={`mt-2 text-xs font-bold ${termEstimate < 2 ? 'text-warn' : 'text-muted'}`}>
                      {termEstimate < 2
                        ? 'Not enough approved terms in these chapters yet. Pick more chapters, turn on multiple-choice answers, or add terms on the Submit page.'
                        : `${termEstimate} secret terms to draw from. Each group gets a different one every round.`}
                    </p>
                  )}

                  <label className={`mt-4 flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 ${useMc ? 'border-info bg-info-soft' : 'border-line bg-panel'}`}>
                    <input type="checkbox" checked={useMc} onChange={(e) => setUseMc(e.target.checked)} className="mt-1 h-4 w-4 accent-purple-400" />
                    <span>
                      <span className="font-bold">Also use multiple-choice answers</span>
                      <span className="block text-sm text-muted">
                        Adds short answers from the Jeopardy and Monopoly questions in these chapters (like &ldquo;Mitochondria&rdquo;).
                        Numbers, true/false and answers like &ldquo;More acidic&rdquo; are left out.
                      </span>
                    </span>
                  </label>

                  <Label className="mt-4">Thinking time</Label>
                  <div className="mt-2 grid grid-cols-5 gap-2">
                    {THINK_CHOICES.map((n) => (
                      <button key={n} type="button" aria-pressed={thinkSeconds === n} onClick={() => setThinkSeconds(n)} className={choice(thinkSeconds === n)}>
                        {n}s
                      </button>
                    ))}
                  </div>

                  <label className={`mt-4 flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 ${hardMode ? 'border-accent bg-accent-soft' : 'border-line bg-panel'}`}>
                    <input type="checkbox" checked={hardMode} onChange={(e) => setHardMode(e.target.checked)} className="mt-1 h-4 w-4 accent-green-400" />
                    <span>
                      <span className="font-bold">Hard mode</span>
                      <span className="block text-sm text-muted">
                        The alien gets a similar term from the same chapter and isn&apos;t told they&apos;re the alien. The group has to spot whose clue doesn&apos;t fit.
                      </span>
                    </span>
                  </label>

                  {smallGroups > 0 && players.some((p) => p.approval_status === 'approved') && (
                    <p className="mt-3 text-xs font-bold text-warn">
                      {smallGroups} group{smallGroups === 1 ? ' has' : 's have'} fewer than {MIN_GROUP_SIZE} students and will sit out until they have enough.
                    </p>
                  )}

                  <Button className="mt-4 w-full text-lg" disabled={busy || pickedTopics.length === 0 || termEstimate < 2} onClick={start}>
                    {busy ? 'Starting…' : 'Start round 1'}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <div className={`${card} md:col-span-2`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl uppercase tracking-wider text-accent">Students waiting</h2>
            <Button
              variant="outline"
              className="!px-4 !py-2"
              disabled={!finalized || waiting.length === 0 || busy}
              title="Approves every waiting student and splits them evenly between the groups"
              onClick={() => studentAction({ action: 'assign_random' })}
            >
              🎲 Randomly assign groups ({waiting.length})
            </Button>
          </div>
          <p className="mt-2 text-sm text-muted">Random assignment only includes students you&apos;ve checked are in the room.</p>

          {!session && <p className="mt-4 text-muted">Create the game first, then students can join with the code.</p>}
          {session && !finalized && <p className="mt-4 text-muted">Finalize the groups so you can put students in them.</p>}
          {session && players.length === 0 && <p className="mt-4 text-muted">No students have joined yet.</p>}

          {waiting.length > 0 && (
            <ul className="mt-4 space-y-2">
              {waiting.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-line bg-panel px-3 py-2">
                  <span className="font-bold">{p.display_name}</span>
                  <span className="flex flex-wrap gap-2">
                    {groupNames.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        disabled={!finalized || busy}
                        onClick={() => studentAction({ action: 'approve_player', player_id: p.id, team_index: i })}
                        className="rounded-lg border-2 border-line px-3 py-1 text-sm font-bold text-white disabled:opacity-40"
                        style={{ background: GROUP_COLORS[i] }}
                      >
                        {groupLabel(i)}
                      </button>
                    ))}
                    <button type="button" disabled={busy} onClick={() => studentAction({ action: 'remove_player', player_id: p.id })}
                      className="rounded-lg border-2 border-line px-3 py-1 text-sm font-bold hover:bg-hover">
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {players.some((p) => p.approval_status === 'approved') && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {groupNames.map((_, i) => {
                const members = players.filter((p) => p.approval_status === 'approved' && p.team_index === i)
                return (
                  <div key={i} className="rounded-lg border-2 border-line bg-panel p-3" style={{ borderTopColor: GROUP_COLORS[i], borderTopWidth: 6 }}>
                    <p className="font-bold">{groupLabel(i)}</p>
                    <p className={`text-xs ${members.length < MIN_GROUP_SIZE ? 'font-bold text-warn' : 'text-muted'}`}>
                      {members.length} student{members.length === 1 ? '' : 's'}{members.length < MIN_GROUP_SIZE ? ` · needs ${MIN_GROUP_SIZE}` : ''}
                    </p>
                    <ul className="mt-1 space-y-1 text-sm">
                      {members.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-2">
                          <span>{p.display_name}</span>
                          <button type="button" aria-label={`Remove ${p.display_name}`} disabled={busy}
                            onClick={() => studentAction({ action: 'remove_player', player_id: p.id })}
                            className="text-xs font-bold text-bad hover:brightness-125">
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
