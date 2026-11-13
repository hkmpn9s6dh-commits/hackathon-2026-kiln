# 05 · Submission pack

Everything the Devpost form asks for, written before the form is opened, plus
the five manual steps that need a Reddit account.

Contest close: **2026-12-08 18:00 PT = 2026-12-09 10:00 Beijing**.

---

## What the judges receive

| Item | Where it comes from |
| --- | --- |
| App link | `https://developers.reddit.com/apps/daily-kiln` after `npx devvit upload` (private upload is enough; the rules say **do not publish**) |
| Demo post | a public post in a small test subreddit running the app |
| README | this repo's `README.md` (how to play, how to run, the port note) |
| Optional: video | ≤ 1 minute, script below |
| Optional: public repo | this repo |
| Optional: feedback survey | the Devpost form's developer-feedback section |

## Manual steps (need the owner's Reddit account)

1. **Log in and link the CLI.**
   ```bash
   npx devvit login          # opens developers.reddit.com
   ```
   If the network blocks reddit.com, run it behind the same proxy the browser
   uses; the CLI respects `HTTPS_PROXY`.
2. **Playtest once** in a test subreddit:
   ```bash
   npm run dev               # = devvit playtest
   ```
   Check: the post renders, the inline card shows today's ware, "Enter the
   kiln" expands, a pot can be placed and fired, the card comes back.
3. **Upload.**
   ```bash
   npx devvit upload
   ```
   Copy the app link from the output.
4. **Make the demo post.** In the test subreddit (public, under 200 members),
   use the moderator menu → **Post today's kiln**, or create the post from the
   app's own install. Copy the post URL.
5. **Fill the Devpost form** and submit before the deadline. Fields below.

## Devpost fields

**Project name:** KILN · 今日窑

**Tagline:** One pot, one firing, one shared kiln, every day.

**Categories:** *Best Daily Game* and *Best Ported Daily Game* (ported from
把桩 / Ba Zhuang, MIT, same author — see "A port, honestly labelled" in the
README; the port note must be ticked in the form).

**Inspiration:** Jingdezhen's wood kilns had no thermometer. The kiln master —
the 把桩 — judged the fire by pulling a test shard out of the fire hole and
reading how far the glaze had melted, and by knowing exactly where in the
chamber each ware should stand. That is a daily puzzle that already existed: one
firing, one place to stand, one irreversible result. We wanted the version a
subreddit could play together.

**What it does:** One pot a day. Everybody in the subreddit fires into the same
kiln on the same schedule. You drag your pot to a spot — the fire mouth is hot,
the flue is cold, and pots already standing on a shelf steal the next one's
draft, so the best spot moves as the community piles in. Then 24 seconds of
holding the fire on the day's curve. What comes out is porcelain, and the glaze
colour is the result: pale and chalky if you underfired, brown and runny if you
overfired, once in a while a copper-red flambé that nobody can reproduce.

**How we built it:** Devvit Web with Hono on the server and React + Canvas on
the client. The simulation is a set of pure functions shared by the client, the
server and the tests, so a score is a *recount* of the firing trace rather than
a number the client claims. The kiln's heat is a continuous field (a bilinear
read of the classic firebox→flue gradient) and the ideal place to stand is drawn
as one pale contour line across the chamber — the entire tutorial is that line.
Redis holds one hash per day; the client never sees a user id. Journeys events
mark app-ready, journey start, pot placement (with coordinates) and the end of a
firing (with score).

**Challenges:** Two, both about honesty. First, a 15-minute single-player game
does not compress into 60 seconds by cutting content — the *decision* has to
change shape, which is why the twelve discrete chambers of 把桩 became a
continuous field with one contour to aim at. Second, a linear tolerance curve
made a 2% firing error cost a whole grade, which read as a bug rather than as
difficulty; a quadratic tolerance fixed the feel without touching the band.

**Accomplishments:** 365/365 days are winnable with careful play and unwinnable
by accident (`proof/balance.md`); a fresh clone runs the whole game locally with
`npm ci && npm run preview`, no Reddit account needed; the artifact is audited
against `devvit.json` statically, because `devvit upload` is the one thing we
cannot run without an account.

**What we learned:** A daily game's content is a *calendar*, not a level list.
Once a day is a pure function of its date, everything else gets easier: results
are comparable, bugs are reproducible, and a reader a month later can recompute
a score.

**What's next:** A longer ware rotation, a "firing of the week" the subreddit
votes on, and a kiln that remembers its own reputation across days.

**Built with:** devvit, devvit-web, typescript, react, hono, redis, canvas,
vite, node.

## Video script (≤ 60s)

| t | Picture | Line |
| --- | --- | --- |
| 0–4 | Feed card | "Reddit's daily game about a kiln that only fires once a day." |
| 4–12 | The kiln, dragging the pot | "Everyone fires into the same kiln. The fire mouth is hot; the flue is cold. The pale line is where today's ware lands true." |
| 12–18 | Readout flipping to OVERFIRE | "But pots steal each other's draft — three people already on that shelf, and your spot runs cold." |
| 18–30 | The fire, holding the button | "Twenty-four seconds to hold the fire on the schedule. The pot lags the flame, so you stoke ahead of the line." |
| 30–42 | The door opens; result card | "Then the door opens, and the colour tells you what happened before the number does." |
| 42–52 | Board + streak | "One pot a day. The board is today's kiln. Tomorrow it's a different ware and a different schedule." |
| 52–60 | Title | "KILN. 今日窑." |
