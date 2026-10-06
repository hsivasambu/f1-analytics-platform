# Progress

## Stage 1 — project foundation

Purpose: establish a runnable shell and shared vocabulary before building a data pipeline. Source records describe observations; SQL will turn those records into measurements; later AI will explain those measurements with evidence references.

Implemented:
- Home and methodology placeholder routes, shared navigation, responsive CSS, semantic headings, keyboard focus and skip link.
- Next.js/TypeScript with pinned direct dependencies and npm lockfile; ESLint, typecheck, two page rendering smoke tests and production build scripts.
- GitHub Actions check workflow with read-only repository permission. No remote repository, push or deployment.
- Five product questions mapped to candidate source endpoints, proposed tables, calculations and charts.
- Actual architecture, version 1 boundaries, proposed folders, decision log, dictionary/metric status and README commands, walkthrough and two exercises with separate answers.

Verification performed:
- `npm run check` passed: lint, TypeScript, 2/2 tests and production build. `/` and `/methodology` prerendered as static routes.
- `npm run dev -- --port 3101` and `npm start -- --port 3100` reached Ready. Both routes returned HTTP 200 and the expected heading on both servers. Servers stopped after verification.
- `npm ls --all` showed no invalid peer dependencies after choosing compatible TypeScript/ESLint majors.
- Clean `npm ci` passed using the lockfile. Updated standalone `npm run typecheck` (Next type generation followed by tsc) also passed.

Limitations:
- No browser visual QA or automated accessibility audit performed. Responsive styles and keyboard affordances exist; the README describes manual checks.
- No race data, ingestion, SQL schema, metrics, charts, snapshots, app APIs, database accounts or AI implemented. Calculation, idempotency, database permissions and AI budget tests are therefore not applicable yet.
- CI configuration exists but has not run on GitHub. Next's development command generated repository agent guidance files.
- Dependency audit reports five high advisory entries in development lint tooling; ESLint 9 is deprecated but matches the installed plugins' peer contract. See D005. No compatible audit fix was offered. Production dependencies had zero advisories at installation.
- No hosting URL was supplied or found. Free-plan terms will be verified at the deployment stage; no service or paid upgrade was enabled.

Checkpoint: run `npm ci`, then `npm run dev`; explain the planned source → ingestion → Postgres → SQL → evidence snapshots → app/AI flow using `architecture.md`.

Next stage: await the user's numbered Stage 2 instructions. Suggested direction only: validate source coverage for three curated historical races and define the schema/metric contracts. No Stage 2 work has started.
