# 08 · Daily content

A daily game lives or dies on the calendar. This is how KILN's year is
generated, why it is generated instead of written by hand, and what the numbers
look like when you sweep it.

## The shape of a day

```
day key (UTC, YYYY-MM-DD)
  ├── ware      = WARES[(day − 2026-11-11) mod 6]      hand-authored, easy → hard
  ├── peak      = lerp(mid/1.22 … mid/0.80, hash(day)) reachable, always
  ├── shape     = one of {steady, rush, slow}           hash(day)
  └── curve     = shape × peak                          eight points, 3s apart
```

Nothing is random at request time. The date is the seed, so the client, the
server, the tests and a reader a month later all compute the same kiln. That is
what makes a score comparable and a result re-checkable.

The rotation is anchored at **2026-11-11**, the first day of the submission
window, so launch week opens with the easiest ware (a celadon bowl with a
±0.06 band) rather than the hardest.

## The six wares

| # | Ware | 中文 | Ideal heat | Band | Body | Why it is where it is |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Celadon lotus bowl | 影青刻花碗 | 0.50 | ±0.060 | thin | Wide tolerance: a first day should not punish. Thin body still cracks if slammed. |
| 2 | Blue-and-white lotus bowl | 青花缠枝碗 | 0.58 | ±0.055 | thick | Slightly higher fire, still forgiving. |
| 3 | Conical tea bowl | 影青斗笠盏 | 0.55 | ±0.050 | thin | The thinnest wall in the set: the fire's *rate* starts to matter. |
| 4 | Blue-and-white covered jar | 青花盖罐 | 0.62 | ±0.045 | thick | Thick body, tight band: placement has to be right. |
| 5 | Blue-and-white meiping | 青花梅瓶 | 0.65 | ±0.046 | thick | Hot fire, narrow tolerance. |
| 6 | Copper-red pear-shaped vase | 霁红玉壶春 | 0.70 | ±0.042 | thin | The hard one: highest heat, narrow band, thin body. "Ten kilns, nine failures." |

Difficulty is not a number in a config: it is the band. A ±0.06 day forgives a
2% firing error; a ±0.042 day does not.

## Why `peak` is derived from the ware

The player commits to a *place* before they fire, and the place multiplies
whatever the fire does. If the day's peak were independent of the ware, some
days would demand a factor the kiln cannot produce (too hot everywhere, or too
cold everywhere), and the player would lose before touching anything.

So `peak ∈ [mid/1.22, mid/0.80]`, which keeps the *required* factor inside the
kiln's real span (0.757–1.230) on every day. The random part only moves it
around inside that window, which is what makes the right shelf different from
day to day:

| Day | Ware | Peak | Factor you need | Where that is |
| --- | --- | --- | --- | --- |
| 2026-11-11 | yingqing-bowl | 0.526 | 0.951 | middle of the chamber |
| 2026-11-12 | qinghua-bowl | 0.682 | 0.850 | toward the flue |
| 2026-11-13 | douli-cup | 0.540 | 1.018 | just past the fire mouth |

## The three schedules

| Shape | Points (as a fraction of peak) | Reads as |
| --- | --- | --- |
| steady | 0.14 · 0.30 · 0.48 · 0.68 · 0.86 · 1 · 1 · 1 | Even climb, long soak. |
| rush | 0.24 · 0.50 · 0.74 · 0.90 · 1 · 1 · 1 · 1 | Fast climb, early soak — thin bodies hate this one. |
| slow | 0.10 · 0.20 · 0.34 · 0.50 · 0.70 · 0.88 · 1 · 1 | Slow start, late peak. Patience pays. |

All three hold the peak for at least six seconds at the end. That soak is both
the historical practice (porcelain matures at temperature; it does not just
reach it) and the design fix that makes the result readable: the "peak" is
measured over the last eight seconds, so a wobble costs less than a trend.

## The calibration sweep

`npm run sweep` walks a year with three reference players. The full table is in
[`../proof/balance.md`](../proof/balance.md); the summary:

| player | what they do | mean | min | max |
| --- | --- | --- | --- | --- |
| careful | reads 1.2s ahead, stands in the best spot | **97.3** | 94 | 99 |
| at the shelf | fires perfectly, stands in the middle | 37.1 | 1 | 98 |
| lazy | lights it and walks away | 6.0 | 6 | 6 |
| impatient | keeps the firebox full | 54.7 | 4 | 90 |

Two things this proves:

1. **Every day is winnable.** 365/365 days reach Fine (74+) with careful play.
   The build fails if that stops being true.
2. **Placement is the game.** A perfect fire in the wrong place averages 37. A
   good fire in the right place averages 97. The gap between "at the shelf" and
   "careful" is where the crowd lives.

The "impatient" column is the useful one for tuning: it ranges 4–90 because
firing hard is *correct* for a thick high-fire ware and ruinous for a thin
low-fire one. That is not noise; it is the day's clay.

## What changes at midnight UTC

- the ware, the peak and the shape;
- the kiln map (a new Redis hash per day);
- the board (the day's pots only);
- the streak (consecutive days, one grace? no — a missed day resets it, and the
  card says so plainly).

The previous day's hash expires after 45 days, so storage stays flat without a
cleanup job.

## Known limits of this calendar

- **Six wares repeat every six days.** With a 60-second loop that reads as a
  weekly rhythm, not a shortage; a longer rotation is the obvious first
  expansion.
- **No difficulty ramp across a week.** Difficulty comes from the ware, and the
  ware cycles; a player who plays daily sees a hard day every six.
- **No seasonal content.** A real launch would add a festival ware or a
  community-set "firing of the week"; both were cut for scope, not because they
  are bad ideas.
