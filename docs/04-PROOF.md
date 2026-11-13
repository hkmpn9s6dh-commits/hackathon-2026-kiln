# 04 · Proof (Gate C)

Each acceptance criterion from [`01-SPEC.md`](01-SPEC.md) §2, with the command
that checks it and what that command actually printed. Nothing here is a
self-assessment.

Run everything at once: `bash scripts/verify.sh` → see
[`../proof/clone-check.md`](../proof/clone-check.md) for the fresh-clone run.

---

## C1 · A day is the same day for everybody

```
$ node --test "src/**/*.test.ts"
✔ a day is the same day for everybody, however often it is asked
✔ day keys are UTC, and roll over at midnight UTC
✔ the same trace always reads the same way
```

`specForDay(key)` is a pure function of the date: the ware, the fire peak and
the schedule shape all derive from `hash32(\`kiln:${key}\`)`. No `Math.random()`
anywhere in `src/shared` (enforced by review, and the determinism test would
catch it).

## C2 · One pot per player per UTC day

```
✔ firing writes exactly one pot and refuses a second
```

Second attempt returns `400 {"type":"error","message":"Your pot is already in
today's kiln. One a day."}`.

## C3 · A score is a recount, not a claim

The request type is `{ x, y, samples }` — there is no score field to forge
(`src/shared/api.ts`, `FireRequest`). The server recomputes the trace with
`readTrace`, multiplies by the chamber factor it reads from Redis at that
moment, and stores its own verdict:

```
✔ a score is a recount of the trace, not a number the client chose
   (a trace that never gets hot → verdict 'under', score < 15)
✔ the flambé roll is per player per day and never in the way of a bad piece
```

## C4 · Crowding costs heat; a full kiln runs cold

```
✔ the crowd really does cost the second pot in the same shelf
   (same trace, same spot: second player's `eff` is strictly lower)
✔ the crowd costs a little and the load costs a little, both capped
```

Caps: `CROWD_STEP 0.008/pot, max 5%`; `LOAD_STEP 0.0005/pot, max 3%`. Both are
visible to the player before they commit (the readout's third line).

## C5 · Every day of a year is winnable

```
$ DAYS=365 node scripts/sweep.mjs
| careful | reads 1.2s ahead, stands in the best spot | 97.3 | 94 | 99 |
Days where a careful player reaches **Fine (74+)**: 365/365.
```

The sweep exits non-zero if any day fails, and `verify.sh` runs it, so the
build goes red the moment the calendar stops being solvable. Full table:
[`../proof/balance.md`](../proof/balance.md).

## C6 · Careless play cannot reach Fine

From the same sweep:

```
| at the shelf | fires perfectly, stands in the middle | 37.1 | 1 | 98 |
| lazy         | lights it and walks away              |  6.0 | 6 |  6 |
| impatient    | keeps the firebox full                | 54.7 | 4 | 90 |
```

Two separate skills, both required: a perfect fire in the wrong place averages
37; the right place with no fire averages 6.

## C7 · The artifact matches the platform contract

```
$ node scripts/preflight.mjs
ok    app name is a legal Reddit app slug  (daily-kiln)
ok    entrypoint "default" is inline (feed card)
ok    server bundle is CommonJS
ok    redis is enabled (the kiln lives in Redis)
ok    journeys are enabled (judged criterion)
ok    menu endpoint is wired in the bundle  (/internal/menu/post-create)
ok    trigger onAppInstall endpoint is wired in the bundle  (/internal/triggers/on-app-install)
ok    task daily-kiln-post endpoint is wired in the bundle  (/internal/cron/daily-post)
ok    no legacy public-api / blocks code
ok    no credentials in the client bundle
ok    client HTML loads nothing off-domain
preflight clean.
```

This is the substitute for `devvit upload`, which needs a Reddit account. It
checks the *built* artifact, not the source.

## C8 · A fresh clone runs from the README alone

See [`../proof/clone-check.md`](../proof/clone-check.md): `npm ci` → 645
packages → `bash scripts/verify.sh` → **14 passed, 0 failed**.

## C9 · The result is legible before the number

`src/client/render/pot.ts` applies a glaze mood from the verdict — chalky for
underfired, browned and run at the foot for overfired, mottled red-under-green
for a flambé — before the card prints a grade. Evidence:
[`../proof/shots/desktop-4-result.jpg`](../proof/shots/desktop-4-result.jpg)
(a Fine piece, pale celadon with a green seal) and
`✔ a thin body cracks when the fire is slammed into it`.

## C10 · First-time comprehension ≤ 15 s — **not yet measured**

This needs a real reader who has not seen the spec. The plan is written down in
[`07-UI.md`](07-UI.md) §4 but the observation has not happened, so it is marked
open rather than claimed. What can be said: the placement readout names the
outcome in words (`LANDS TRUE · 91` / `WILL OVERFIRE · 12`) before the player
commits, which is the cheapest possible substitute for a tutorial.

## C11 · The share line gives nothing away

```ts
shareText({ dayKey, ware, zh, verdict, score, chamber })
// KILN · 13/11/26 — Conical tea bowl (影青斗笠盏)
// Fine 87/100 · 窑身中
```

No coordinates, no schedule, no score of anyone else. One line, postable, and it
doesn't spoil where to stand — which is the only thing a friend could copy.

## C12 · The return loop is visible on a phone

`proof/shots/mobile-0-splash.jpg` (390×760): the inline card carries today's
ware, how many pots are in the kiln, and whether you have fired. The result card
carries streak, countdown and tomorrow's ware above the fold at 390px.

---

## What is not proved here

| Thing | Why | Where it is handled |
| --- | --- | --- |
| `devvit playtest` / `devvit upload` / demo post | needs a Reddit account and a session | `docs/05-SUBMISSION.md`, manual steps 1–5 |
| Gate D (blind ranking against award winners) | needs two judges who did not build it | not started in this build; see the issue comment |
| Sound | not implemented | declared out of scope in `01-SPEC.md` §4 |
