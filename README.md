# PLTL Imposter

A social-deduction review game for PLTL sessions. Every group gets a secret term each round; one student in
each group (the imposter) only sees the chapter. Students get thinking time, give one clue each out loud in
the order on screen, then vote on their phones. A caught imposter gets one guess at the term.

- `/` the leader: lobby (groups, chapters, thinking time, hard mode), then the projector board
- `/join` students' phones

The terms are the answers of approved open-response questions in the shared question bank (the same ones
the PLTL Escape Room uses: short answers of 1 to 4 words, no numbers). Submit and review those questions on
the Escape Room site.

Backend: the shared Supabase project (`imp-game` and `imp-play` Edge Functions, `imp_*` tables).

## Run it

```
npm install
cp .env.example .env.local   # add the Supabase URL and publishable key
npm run dev
```
