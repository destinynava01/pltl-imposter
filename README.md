# PLTL Imposter

A social-deduction review game for PLTL sessions. Every group gets a secret term each round; one student in
each group (the imposter) only sees the chapter. Students get thinking time, give one clue each out loud in
the order on screen, then vote on their phones. A caught imposter gets one guess at the term.

- `/` the leader: lobby (groups, chapters, thinking time, hard mode, multiple-choice switch), then the projector board
- `/join` students' phones
- `/submit` anyone: submit new terms (a term plus a short description), filed under a chapter
- `/review` reviewers (same sign-in and reviewer list as the other PLTL sites): approve, edit, reject terms, and
  handle terms flagged after a game

Terms come from Imposter's own approved prompts (`imp_prompts`). With the lobby switch on, the game also uses
short answers of approved multiple-choice questions in the chosen chapters (numbers, true/false and answers like
"More acidic" are left out). Lab picture questions are not used.

Backend: the shared Supabase project (`imp-game`, `imp-play`, `imp-prompts` and `imp-prompt-review` Edge
Functions, `imp_*` tables).

## Run it

```
npm install
cp .env.example .env.local   # add the Supabase URL and publishable key
npm run dev
```
