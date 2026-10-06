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

## Stage 2 — OpenF1 data investigation

Purpose: inspect actual source records, their grain and gaps before selecting database types or calculating race analytics.

Implemented:
- Historical session discovery CLI and bounded investigation; at most three candidate probes, two-driver lap sample, six allowed metadata/data endpoints. No telemetry or full-season race download.
- Sequential rate spacing, bounded transient retries, Retry-After handling, request/body timeouts and response byte/row limits; clear nonzero failure output.
- Unchanged raw JSON archived in gitignored per-run directories with URL, filters, UTC retrieval time and SHA-256 provenance. Generated JSON/Markdown field profile, candidate keys, join checks and candidate access report.
- Reviewed derived profile and Stage 2 guide with exact commands, walkthrough, source semantics, candidate proposals and two exercises (one SQL) with separate answers.
- GitHub repository created and foundation pushed. Foundation GitHub Actions completed successfully: https://github.com/hsivasambu/f1-analytics-platform/actions/runs/37405732906. Stage 2 implementation committed as 1618833 and pushed to the same repository. Its GitHub Actions run completed successfully: https://github.com/hsivasambu/f1-analytics-platform/actions/runs/37406345698.

Actual source investigation (October 5, 2026 Toronto / October 6 UTC):
- OpenF1 official documentation reviewed. No login/token required for these historical endpoints.
- 24 real 2024 main-race sessions discovered. Las Vegas 9644, Qatar 9655 and Abu Dhabi 9662 all passed five endpoint access/nonempty probes.
- Selected Las Vegas only after coverage checks; drivers 1 and 4 contributed 50 laps each. Numeric lap durations for all 100; unique sampled lap keys; no driver orphans; exactly one stint range per sampled lap.
- Three candidates proposed based on those actual responses. Stationary-duration null counts are 1/39, 33/60 and 0/28 pit events respectively. Preserve missing measurements.
- Initial malformed lap-filter run failed before selection and remains archived. Corrected comparison URL builder, added regression assertion and reran successfully (19 logical queries).

Verification:
- `npm run check` passed: lint, type generation/types, 11/11 tests and production build of both unchanged app routes.
- Tests meaningfully simulate 429/Retry-After, bounded 503 retries, 403 and invalid payload rejection, timeout abortion, row/byte caps, discovery exclusions, candidate-key problems and absent/null/zero distinctions. These are mocked tests; live run succeeded without retries.
- Verified all 19 raw response hashes still match the manifest after a separate discovery run created a new directory. `git check-ignore` confirms the raw archive is excluded. Unsupported year 2026 fails before creating a run or making requests.

Limitations:
- Candidate nonempty/early-lap probes are not full-race coverage certification. Only one race has an extended two-driver lap sample.
- Top-level observed field types are not database schema declarations; entirely absent fields require comparison with docs, and nested array nulls are not counted as field nulls.
- Documentation says race mini-sector segments are unavailable, while actual sample arrays exist; preserve but do not use them analytically.
- No Postgres, migrations, production ingestion/upserts, race metrics, charts, app APIs or AI added. Database permissions, analytical correctness and AI budget tests remain for their implementation stages. Repeat investigation archives evidence; it is not database idempotency.
- Stage 1 development dependency advisories remain documented. No website deployment, paid upgrade or free-plan hosting verification performed at this non-deployment stage.

Checkpoint: run `npm run data:investigate -- 2024`, inspect local raw records and profile, explain lap grain and why lane duration differs from stationary time. The app still runs with `npm run dev` independently of OpenF1.

Next stage: await the user's numbered Stage 3 request. No schema or later features have been implemented.

## Stage 3 — schema and database setup

Purpose: give source observations explicit grains, keys, relationships and provenance before production ingestion or race calculations.

Implemented:
- Three versioned SQL migrations for sessions, internal provisional driver identities, session entries, laps, stints, pit/control event content occurrences, ingestion runs, original response payloads and array-element records. Composite keys and foreign keys reflect source scope.
- Exact-decimal seconds, timezone-aware instants, raw response text/JSON preservation, nullable unknowns, source endpoint/key guards, immutable raw archive, event deduplication keys and targeted indexes.
- Explicit migration runner with advisory lock, transactions and SHA-256 ledger; restricted SQL-created ingestion/application logins with locally generated credentials; transactional synthetic fixture and database verification.
- Separate gitignored development/production environment files plus tracked empty .env.example. Development and production owner/restricted URLs are configured locally; no secrets were printed or committed. No NEXT_PUBLIC_ credential variables.
- Isolated local development Postgres 18 container f1-analytics-stage3-dev on 127.0.0.1:15432 with a named volume; other containers untouched.
- Updated implemented data dictionary, architecture/decisions, Stage 3 walkthrough and two exercises with separate answers (SQL AVG answer computed on the fixture). CI adds disposable Postgres checks without any local/Neon secrets.

Verification actually performed:
- Three migrations applied to local development Postgres; repeated runs apply zero versions. Restricted role provisioning rerun retains logins/passwords.
- Tiny synthetic fixture inserted and queried, then rolled back. Three rows retain decimal/NULL values and session-specific driver names; joining only on driver number incorrectly makes six rows.
- Real database checks pass for UUID/composite FKs, duplicate lap rejection, negative/NaN durations, UTC equivalence with original offset string preserved, wrong provenance endpoint/source keys, immutable archive and invalid source ordinal rejection.
- Event checks retain three pit occurrences with two distinct content hashes and two same-time control records with different scopes. Replayed event content/occurrence keys are rejected while source response/row observations are retained in the transactional check.
- Real application and ingestion logins have no admin flags/neon_superuser membership, no DDL/public-schema/temp access; app reads typed tables but insert/update/delete/truncate/raw/meta access fails with SQLSTATE 42501. Ingestion can write a run but cannot delete typed rows or mutate raw payloads.
- Database fixture/verification rolls back all inserted rows; local migrations and roles remain. LF normalization reconciled only matching initial local ledger hashes without changing SQL statements; .gitattributes preserves LF for subsequent checkouts.
- Final `npm run check` passed: lint, types, 14/14 unit/smoke tests and the static production build. `db:verify` passed after final script changes. Production fixture invocation was actually rejected before connecting. Git ignore checks cover all three local credential files. Stage 3 implementation b829c9e was committed/pushed, and fresh-Postgres GitHub CI passed all app checks, all three migrations, role provisioning, fixture query and database verification: https://github.com/hsivasambu/f1-analytics-platform/actions/runs/37408128495.

- Neon follow-up: `npm run check` passed (lint, types, 14/14 tests, static production build). New read-only `db:audit` passed against both live Neon environments; CI now runs it against disposable Postgres. Environment files remain gitignored. No application database integration or later-stage feature was added.

Neon status and limitation:
- Official Free quota document checked October 5, 2026: 100 projects, 10 branches/project, 100 CU-hours/project/month, 1 GB Postgres/project (20 GB account cap), 5 GB public transfer/project/month, 5-minute scale-to-zero. Older indexed sources differ; the guide tells the user to honor the lower console allowance if needed. No paid option/upgrade chosen.
- User supplied direct owner URLs in correctly labelled, gitignored development/production env files. Distinct Neon endpoints were validated; all three migrations applied to each. Restricted app/ingestion credentials were generated locally, replacing the prior development restricted URLs. Actual TLS sockets are encrypted with authorized certificates. Development fixture/constraint/permission checks passed and rolled back; read-only audits passed on both environments with zero session rows. Repeated migration and role setup applies zero migrations and retains credentials.
- Available Console browser remains signed out. Account Free status, project names/independent project membership and compute settings were not independently verified. Distinct endpoints prove separate connection targets, not separate projects. No paid upgrade was selected. Published official quotas were rechecked.
- No historical records imported into Postgres, production ingestion/upserts, analytics, DB-backed app APIs, snapshots or AI added. Those remain outside Stage 3. Event corrections/identity reconciliation need later reviewed policies; non-key typed mapping is a later ingestion responsibility.

Checkpoint: run db:migrate → db:roles → db:fixture → db:verify against development; explain each table's grain, the session-entry/lap join, event-content keys and index tradeoffs. App still runs without a database. Remote database steps are complete. Run db:audit for either environment; confirm Free status, project names/independence and modest compute in Console. See stage-3-database.md for exact recheck commands and the two exercises.

Next stage: await the user's numbered Stage 4 request; Console-only plan/project confirmations remain documented. No later-stage features implemented.
