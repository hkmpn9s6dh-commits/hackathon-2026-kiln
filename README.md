# KILN

**One wood kiln a day. The whole subreddit fires it together.**

A daily game for Reddit, built on Devvit Web. You get one piece and one shelf.
Where you put it decides whether it comes out fine — and every piece already in
that chamber pulls the heat down, so the whole subreddit is loading the same kiln.

> Reddit's Game of the Day Hackathon · 2026-11-11 → 2026-12-08 (18:00 PT)

## Play

On Reddit: open today's KILN post, tap **Enter the kiln**.

Locally, without Reddit:

```bash
npm ci
npm run build
npm run dev:web -- --seed     # http://127.0.0.1:4319/game.html
```

## How a day works

1. **Load.** The kiln has nine shelves in three chambers — fire mouth (hot),
   body (middle), tail (cold). Pick one of three wares, tap a shelf. Each piece
   already in a chamber costs that chamber 7°C.
2. **Stoke.** Three strokes. Stop the needle inside the band; each stroke is
   worth −6°C to +12°C. This is the only part that is pure skill.
3. **Open.** The kiln door swings open and the piece is graded against the
   temperature its glaze wanted: transmutation / fine / sound / underfired /
   overfired.
4. **Tomorrow.** One piece per potter per day. The kiln rolls at 00:00 UTC, a new
   post is lit at 00:05, and a seven-day streak multiplies the score.

If the finished load is spread evenly (no chamber more than one piece off the
others), the whole kiln gets **窑火顺** — a shared bonus for everyone who fired
that day. That is the reason to talk to each other in the comments.

## Verify

```bash
bash scripts/verify.sh
```

Runs, in order: type check → unit tests (365 days of kiln solvability) → build →
static preflight on `devvit.json` and the bundle → end-to-end play in a real
browser → hygiene checks.

## Stack

- TypeScript strict, React 19, Vite. No UI framework, no CSS-in-JS.
- Canvas 2D, everything drawn procedurally: bricks, fire, smoke, nine glazes.
- Sound synthesised with WebAudio; no audio files.
- Server: Hono on Devvit's Node runtime, Redis for the shared kiln.
- The kernel (`src/shared/kiln.ts`) is pure functions, no imports — the client,
  the server and the tests call the same code, so a piece fired in a test is the
  piece the server accepts.

## Layout

```
src/shared/kiln.ts      the rules: kiln generation, stoking, grading, scoring
src/shared/api.ts       request/response types shared by both sides
src/server/             Hono routes, Redis-backed store, daily post task
src/client/             splash card, game screen, canvas renderer, audio
scripts/                local harness, e2e, preflight, screenshots
docs/                   spec, sources, proof, design, submission copy
```

## Licence

MIT. The kiln and the wares are our own work — this is a port of the firing
mechanic from **《把桩》 / Ba Zhuang** (also MIT, 2026), retuned from a 20-minute
night into a 60-second daily.
