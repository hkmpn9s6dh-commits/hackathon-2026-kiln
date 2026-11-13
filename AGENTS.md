# Working on KILN

Devvit Web app. Two entrypoints, one server, one shared kernel.

## Layout

- `src/shared/kiln.ts` — the rules. Pure functions, **zero imports**. The client, the
  server and the tests all call it. If you need a new rule, it goes here first, with a test.
- `src/shared/api.ts` — the wire types.
- `src/server/` — Hono routes, `core/store.ts` (Redis), `core/post.ts` (custom post).
  The server bundle must stay CommonJS.
- `src/client/` — `splash` (feed card) and `game` (expanded view). Canvas drawing is in
  `kiln-canvas.ts`; sound in `audio.ts`.

## Commands

```bash
npm run typecheck   # tsc --build
npm run test        # vitest, single fork (this machine corrupts parallel runs)
npm run build       # vite build → dist/client + dist/server
npm run preflight   # devvit.json + bundle checks
npm run dev:web     # local harness, no Reddit needed: http://127.0.0.1:4319/game.html
npm run e2e         # real browser, real store, fake Redis
bash scripts/verify.sh
```

## Rules that are easy to break

- One piece per potter per day: `hSetNX` in `submitPiece`, never a read-then-write.
- Never trust the client for temperature, grade or score — the server recomputes from
  `wareId`, `slotId` and three clamped taps.
- Every day's kiln must be solvable: the 365-day test in `kiln.test.ts` will fail if you
  add a ware or widen the crowd penalty without checking.
- `drawKiln` never resets the canvas transform; the caller has already applied the
  devicePixelRatio. Reset it and the drawing shrinks to half size.
- No external assets: no image files, no audio files, no CDN. Fonts come from
  `@fontsource-variable` and are bundled.
