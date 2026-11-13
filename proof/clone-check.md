# Fresh clone check (Gate C)

What a judge is promised: **clone it, `npm ci`, run one command, everything is green.**
This is that run, recorded.

| | |
| --- | --- |
| When | 2026-11-13, 19:50 UTC |
| Machine | Windows 11, Git Bash, Node v24.11.0, npm 11.6.1 |
| Source | `git clone --depth 1 -b kiln/cb-build https://github.com/hkmpn9s6dh-commits/hackathon-2026-kiln.git` |
| Commit | `7600292 Normalise line endings for scripts and sources` |
| Install | `npm ci` → `added 645 packages in 2m` |
| Then | `bash scripts/verify.sh` |

```
     PASS node v24.11.0
     PASS tsc --build
     PASS eslint
     PASS node --test
     PASS vite build
     PASS devvit.json ⇄ artifact
     PASS 365-day sweep
     PASS no localhost in shipped source
     PASS no absolute local paths
     PASS no TODO/FIXME in src
     PASS no console.log in src
     PASS server answers /api/health
     PASS GET /api/init returns a day
     PASS POST /api/fire rejects a firing with no trace
 14 passed, 0 failed
 verify: clean
```

Notes:

- No environment variables, no `.env`, no local config were needed. The proxy was
  set only because this machine cannot reach npm without it; a normal connection
  needs nothing.
- `npm ci` (not `npm install`) is what the README says, and it is what was run.
- The build writes `dist/`; the preflight step reads the *built* artifact, so a
  green run means the thing that would be uploaded, not the source.
- The HTTP step starts the real preview server on a random port, calls
  `/api/health`, `/api/init`, and posts a deliberately empty firing to confirm
  the server refuses it with 400.
