# 01 · SPEC

Written before the first line of game code, in the order the rules require:
**demo script first, then testable acceptance criteria**. The scoring table goes
first of all, because every later decision is an answer to it.

---

## 0. What we are being scored on (official, 25% each)

| Criterion | What the judges are told to look for | KILN's answer |
| --- | --- | --- |
| **Delightful UX** | Intuitive onboarding, a focused loop, a clear end state. | Four beats, each one verb: *load, fire, open, come back.* The pale line across the kiln teaches the core decision without a word of tutorial; the fire is one button; the firing ends itself at 24 seconds. |
| **Polish** | Visual craft, sound, motion, no rough edges. | Every surface is drawn in code (no image assets): the kiln's heat field, the flames, the porcelain, the card. One palette, one light source, one type scale. Reduced-motion is honoured; the door-opening reveal degrades to a cut. |
| **Reddit-y** | Does it belong in a subreddit, or is it a game with a Snoo sticker? | The kiln is shared and finite *per subreddit per day*. Crowding is real arithmetic, so the best spot moves as the community arrives. The daily thread is the coordination channel: "fire mouth is full, go up". No karma, no Snoo, no Reddit in-jokes. |
| **Daily Content** | Calibrated daily content, a reason to return, a clean reset. | One UTC day = one ware + one fire schedule, identical for everyone, seeded from the date. 365/365 days are winnable (`proof/balance.md`). Streak, countdown, tomorrow's ware, and a fresh thread at 00:05 UTC. |

Bonus the brief names explicitly: **Devvit Journeys** events — `app.ready`,
`journey.start`, `journey.interaction` (pot placed, with coordinates),
`journey.end` (complete + score).

Penalties the brief names: AI slop, forced Reddit references, overdone genres
(space shooter, reskin, simple platformer, collaborative storytelling, trivia),
and "didn't really run on Reddit". KILN is a porcelain kiln; the whole game is
one screen of one object; it runs in a Reddit post or it does not run at all.

## 1. Demo script — the 60 seconds a judge will actually spend

Written first. If any line of this is boring, the game is wrong.

| t | What happens | What it proves |
| --- | --- | --- |
| 0:00 | Post card in the feed: today's ware, its ideal heat, "12 pots in the kiln · you haven't fired yet", one button. | Onboarding is a sentence and a button. |
| 0:04 | Expanded view. A kiln cross-section: dark brick, one fire mouth glowing, a pale line running across the chamber, other people's pots standing where they left them. | The screen *is* the rule. Nobody has to read a manual. |
| 0:10 | Drag the pot. The readout follows: `LAND TRUE · 91`, `heat 0.57 · band 0.50–0.60`, `3 pots on this shelf`. Slide toward the fire mouth and it flips to `WILL OVERFIRE · 12`. | Placement is a continuous decision with immediate feedback, and the crowd is visible while you decide. |
| 0:18 | Set it down, press **Light the fire**. The chamber closes in, flames rise, a schedule appears. | The second verb is physical, not a menu. |
| 0:22 | Hold the button. The flame roars, the pot's left side goes gold. Release and it settles. The trace crawls along the dashed line. | One finger, real feedback, a visible skill. |
| 0:38 | At 24 seconds the fire stops by itself; the button becomes **Open the kiln**. | A clean end state, no "are you sure". |
| 0:46 | The door opens as a band of light: the pot is revealed, and it is celadon — or brown and runny, or chalky. The card slides up: verdict seal, the pot's colour, one line about what happened, 87/100, #3 of 10 today. | The result is an object, not a number. The colour is the score. |
| 0:56 | "Tomorrow the kiln is loaded with *Blue-and-white covered jar*", countdown to 00:00 UTC, streak `1 day`, share button. | The return loop is stated, not hoped for. |

## 2. Acceptance criteria

Each one is checkable by a command in this repo or by one observable action.
`scripts/verify.sh` covers C1–C9; C10–C12 are checked in
[`04-PROOF.md`](04-PROOF.md).

| # | Criterion | How it is checked |
| --- | --- | --- |
| C1 | A day is identical for the client, the server and any later reader. | `src/shared/sim/daily.test.ts` — determinism of `specForDay`; `fire.test.ts` — same trace, same read. |
| C2 | One pot per player per UTC day; a second attempt is refused with a reason. | `src/server/service.test.ts` — "firing writes exactly one pot and refuses a second". |
| C3 | A score is a recount of the submitted firing trace; the client cannot post a score. | `api.ts` has no score field; `service.test.ts` — "a score is a recount of the trace". |
| C4 | Being crowded costs heat, and a fuller kiln runs colder for everyone. | `service.test.ts` — "the crowd really does cost the second pot"; `daily.test.ts` — caps. |
| C5 | Every day of a year is solvable: a careful player reaches Fine on 365/365 days. | `npm run sweep` → `proof/balance.md`; fails the build otherwise. |
| C6 | Careless play cannot reach Fine: idle and full-feed bots score far below. | `proof/balance.md` (lazy 6.0 mean, impatient 54.7 mean vs careful 97.3). |
| C7 | The artifact matches `devvit.json`: every declared endpoint is served, every entrypoint exists, no credentials, no off-domain loads. | `node scripts/preflight.mjs`. |
| C8 | A fresh clone runs the game from the README alone. | `proof/clone-check.md`. |
| C9 | The result is legible before the number: the pot's glaze changes with the firing. | `proof/shots/desktop-4-result.jpg` plus `evaluate.test.ts` verdicts. |
| C10 | First-time comprehension: a player who has not read this document picks a spot on the band within 15 seconds. | Gate D observation, recorded in `04-PROOF.md`. |
| C11 | The share line gives nothing away and still says something. | `shareText()` — date, ware, verdict, score, shelf. No coordinates, no schedule. |
| C12 | Return loop is visible without scrolling on a 390px screen: streak, countdown, tomorrow's ware. | `proof/shots/mobile-0-splash.jpg` + the result screen at 390px. |

## 3. Golden path

The one path that must never break, and the order it is built in:

```
open post → /api/init (day, ware, schedule, pots, me)
          → drag → place (x, y)
          → "Light the fire" → 24s local sim → samples[]
          → POST /api/fire {x, y, samples}
          → server: cell crowd → factor → readTrace → evaluate → store
          → result card → share / board / streak
          → 00:00 UTC: new day, new ware, new schedule, same kiln
```

Anything that is not on this path is optional and was cut: no second game mode,
no inventory, no cosmetics, no accounts, no push notifications.

## 4. Out of scope (deliberately)

- **Anti-cheat beyond recounting.** A determined player can synthesise a
  perfect trace. Daily casual games accept this; we cap the payload, validate
  the shape, and recount on the server. Written down rather than pretended.
- **Cross-subreddit leaderboards.** Redis is per-installation by design; a
  global board would need an external service and a privacy story.
- **Sound.** The WebAudio budget went to nothing in this round; the brief ranks
  visual craft higher than audio, and a bad sound is worse than silence.
