# F1 Race Analyzer

A runnable Next.js/TypeScript foundation plus a Stage 2 local OpenF1 investigation CLI. The app does not display race data yet; no database, production ingestion or AI is implemented.

## Run locally (PowerShell)

Install Node.js 22 LTS (22.18.0 or newer). In this directory:

```powershell
npm ci
npm run dev
```

Expected: dependencies install from `package-lock.json`; Next prints a Local URL and Ready. Open http://localhost:3000 (use the printed port if 3000 is occupied). The home page shows the foundation status and five product questions. Select **Read the methodology**; `/methodology` explains evidence principles and current limitations. Use the top navigation to return home. Try keyboard Tab navigation and a narrow browser window.

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

Expected: lint and typecheck exit 0; tests report 2 passed; build lists `/` and `/methodology` as static routes. `npm start` serves the production build. Stop either server with Ctrl+C. `npm run check` runs all four checks in order. No `.env` file or account is needed.

## Where things belong

Read [architecture](docs/architecture.md), [product questions](docs/product-questions.md), [decisions](docs/decisions.md) and [progress](docs/progress.md). Only `src/app` and the foundation tests exist today; the architecture names future locations without implementing them.

## Learning exercises

1. **Trace a request.** Locate the page that serves `/methodology`, then identify which file supplies navigation shared by both pages. Explain why neither page needs a database connection. Run `npm test` afterward.
2. **Reason about matched laps in SQL.** Without installing a database, use the scratch query below to predict which rows match. Driver A has laps 1 and 2; B has only lap 2. Predict the output and explain why matching on driver would be wrong. This uses fictional values, not F1 evidence. You can run it later in Postgres when that stage exists.

```sql
WITH a(lap_number, seconds) AS (VALUES (1, 90), (2, 88)),
     b(lap_number, seconds) AS (VALUES (2, 89))
SELECT a.lap_number, a.seconds - b.seconds AS a_minus_b_seconds
FROM a JOIN b ON a.lap_number = b.lap_number;
```

### Answers (read after trying)

1. `src/app/methodology/page.tsx` supplies the route; `src/app/layout.tsx` supplies navigation. Both render local content only.
2. One row: lap 2, difference -1 second. Lap 1 has no counterpart. Matching drivers would compare identities rather than the same race lap. A real query must also match the race/session and apply explicit eligibility rules.

## Stage 2 investigation

The [Stage 2 guide](docs/stage-2-investigation.md) contains exact CLI commands, actual coverage findings, a record walkthrough and two exercises with separate answers. Run `npm run data:discover -- 2024` for session metadata or `npm run data:investigate -- 2024` for the bounded investigation. Raw JSON is retained under gitignored `data/raw/openf1/`; the derived [profile](docs/openf1-profile.md) documents the observed sample. The app remains the Stage 1 shell.
