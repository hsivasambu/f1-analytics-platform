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

- Neon follow-up: `npm run check` passed (lint, types, 14/14 tests, static production build). New read-only `db:audit` passed against both live Neon environments; Fresh GitHub CI for commit 61dd790 passed all app checks, migrations, fixture/permission verification and the read-only audit against disposable Postgres: https://github.com/hsivasambu/f1-analytics-platform/actions/runs/37411506824. Environment files remain gitignored. No application database integration or later-stage feature was added.

Neon status and limitation:
- Official Free quota document checked October 5, 2026: 100 projects, 10 branches/project, 100 CU-hours/project/month, 1 GB Postgres/project (20 GB account cap), 5 GB public transfer/project/month, 5-minute scale-to-zero. Older indexed sources differ; the guide tells the user to honor the lower console allowance if needed. No paid option/upgrade chosen.
- User supplied direct owner URLs in correctly labelled, gitignored development/production env files. Distinct Neon endpoints were validated; all three migrations applied to each. Restricted app/ingestion credentials were generated locally, replacing the prior development restricted URLs. Actual TLS sockets are encrypted with authorized certificates. Development fixture/constraint/permission checks passed and rolled back; read-only audits passed on both environments with zero session rows. Repeated migration and role setup applies zero migrations and retains credentials.
- After user sign-in, Console verified October 6, 2026: Free Plan ($0/month), independent f1-analytics-platform-dev and f1-analytics-platform-prod projects, AWS Ohio, Postgres 18, one primary compute/default branch each. Endpoint IDs match the env targets. Both autoscale 0.25–2 CU and suspend after five idle minutes; settings inspected without changes. Each showed 31.69 MB storage. No paid upgrade selected; official quotas rechecked.
- No historical records imported into Postgres, production ingestion/upserts, analytics, DB-backed app APIs, snapshots or AI added. Those remain outside Stage 3. Event corrections/identity reconciliation need later reviewed policies; non-key typed mapping is a later ingestion responsibility.

Checkpoint: run db:migrate → db:roles → db:fixture → db:verify against development; explain each table's grain, the session-entry/lap join, event-content keys and index tradeoffs. App still runs without a database. Remote database and Console verification steps are complete. Run db:audit for either environment; all required account/project confirmations passed. See stage-3-database.md for exact recheck commands and the two exercises.

Next stage: await the user's numbered Stage 4 request. Stage 3 checkpoint complete. No later-stage features implemented.


## Stage 4 — ingestion for one historical race

Purpose: a bounded, traceable ELT pipeline that atomically replaces one historical session and preserves its last successful dataset on failure.

Implemented:
- CLI `data:ingest -- 9644 [--env development|production]` allows the Stage 2 investigated Las Vegas session only. Six full-session endpoints; 2 MB/2,000-row caps; six logical requests/18 maximum attempts; 20-second timeout; bounded transient/rate-limit retries and 2.1-second spacing. No telemetry, bulk season downloads or public/UI ingestion endpoint.
- Validate arrays, source keys/types/timestamps/natural-key uniqueness/driver joins, completed race and nonempty endpoints. Raw original text and unknown fields survive; mapped unknowns become NULL.
- Migration 004 adds transactional private staging, session dataset/version and run endpoint/checksum/count/change metadata. Session lock covers fetch/publication. Restricted fixed-search-path SQL functions publish archive/typed replacement/version/status/retention atomically or record failure separately.
- Identical response bytes retain raw/typed rows/version; changed responses replace the complete session and remove absent rows. Raw-object multiset additions/removals record corrections as replacement. Event surrogate IDs may change. Linked driver identities block this initial refresh mapping.
- Retain latest successful six payloads/source records; latest 20 compact run summaries plus a protected older dataset origin (at most 21 completed summaries). No failed raw copies or staging left after rollback. Next CLI marks interrupted running attempts failed. Existing Stage 2 local files preserved.
- Parameterized provenance inspection SQL/CLI, dedicated local f1_stage4_test integration database and ignored test URLs. CI uses disposable f1_test without Neon secrets. Stage 4 guide explains ELT, exact commands/walkthrough, tradeoff and two exercises with separate answers.

Verification actually performed:
- Migration 004 applied to dedicated local test database and both Neon environments, preserving earlier migration files/checksums.
- Real local integration tests pass: identical fixture twice without typed/raw growth, duplicate pit occurrences, malformed input, simulated endpoint outage, SQL constraint failure with old data retained, reader seeing old race before COMMIT, corrections/deletions, provenance trace and bounded history over 22 further repeats. App publication/general ingestion DELETE denied; synthetic rows removed only from guarded local test database.
- Two actual development OpenF1 ingestions succeeded with identical version 717419c96131a938952397e5c9a168d27c4c8c0c2fa176be6b846f157b7ebad0. Stable counts: 1 session, 20 entries, 940 laps, 59 stints, 39 pit events, 37 control events. SQL inspection after repeat: six payloads, 1,096 source records; 937 known/three NULL lap durations. Driver 1/lap 1 duration 106.37 seconds traces to raw laps ordinal 7 and its URL/checksum/run/version.
- Existing live development constraints/permissions verification passed without changing the real race. Its intentionally wrong synthetic join now restricts both sides to fixture sessions, preventing real driver-number matches from changing the teaching answer. Production read-only audit passes four versions, zero sessions and restricted TLS/identity/grants.
- Fresh GitHub CI passed for implementation eab8b22: app check, all four migrations, roles/fixture/schema/permission audit and committed ingestion integration suite on disposable Postgres: https://github.com/hsivasambu/f1-analytics-platform/actions/runs/37413237490.
- Final `npm run check` passed lint, types, 16/16 unit/smoke tests and production static build. A transient Windows/OneDrive EPERM cache error was resolved by removing only the verified generated .next cache and rebuilding. Final local ingestion integration suite and live development audit passed; production remains empty. No deployment or paid upgrade/live subscription performed.

Limitations:
- Shape/key/join/nonempty checks cannot certify complete real-world source coverage; valid upstream omissions are authoritative deletions on successful refresh. Review recorded source-object changes/counts.
- Only latest raw source version is replayable; older checksums/counts/change summaries remain until bounded pruning. JSON formatting/order can change versions even when objects are equivalent. Event IDs are not physical incident identity.
- Interrupted status is reconciled on next CLI, with no scheduler added. Rate spacing is per process. Future multi-query app reads require a consistent transaction.
- Production remains empty; app still works without DB reads. No race analytics, charts, app APIs, snapshots or AI. No AI budget behavior exists to test yet.

Checkpoint: ingest twice, inspect stable counts/version and trace a lap. This is ELT: extract, validate, load raw staging, project typed values in SQL, then commit. See stage-4-ingestion.md for commands and exercises.

Next stage: await the user's numbered Stage 5 request. Do not implement later features.

## Stage 5 - quality reporting and analysis eligibility

Purpose: inspect source integrity and conservatively identify usable comparison observations without rewriting raw history.

Implemented:
- Migration 005: source/policy-version quality reports, per-source-occurrence lap assessments, reader SELECT grants and restricted 20-version retention. Automatic analysis runs inside ingestion publication before COMMIT; standalone data:quality uses the same lock/consistent transaction and bounded local JSON exports.
- Integrity checks: natural-key duplicates, source session/driver references, manifest/projection counts and keys, invalid durations. Hard failures block all candidates. Missing durations stay NULL; legitimate gaps, early driver histories, empty endpoints, pit timing disagreements and ambiguous stints remain inspectable warnings. Explicit retirement evidence is separate from coverage claims.
- Pit source lap/timestamp and pit-out exclusions; half-open lap/control windows; separate safety-car/VSC/red neutralization, yellow warning, blue warning and uncertain boundary classifications. Pit-exit green lights and pending ending messages cannot establish normal track state. Explicit car/lap deletion notices map by identifiers rather than announcement timestamp. Every green status is not_established.
- One-second manual conservative boundary buffer, never described as a measured timing error. Unknown/estimated intervals remain labelled. Eligibility leaves raw and typed observations intact. No UI-triggered ingestion/public write API, analytical performance metric, app quality UI, snapshots or AI added.
- Architecture/dictionary/metric definitions/decision log and stage-5-quality.md describe actual behavior, exact commands, walkthrough, tradeoff and two exercises with separate answers.

Verification actually performed:
- npm run check passed lint, TypeScript, 29/29 tests and static production build. Synthetic tests cover absent/NULL/zero/invalid durations, duplicate keys/orphans/manifests, gaps/retirement, ambiguous stints, pit evidence, half-open neutralization boundaries, VSC ending versus ended, red resumption, pit-exit green/DRS, sector/driver yellow scopes, post-coverage events, delayed deletion notices and unavailable timestamps.
- Dedicated local database integration passed: repeat ingestion produces one report/two assessments; malformed/outage/SQL failure preserves prior report; successful correction retains older assessment evidence after raw pruning; publication remains atomic; app cannot update assessments; distinct versions retain exactly 20 reports. Fixture cleanup touches only the guarded disposable local database.
- Migration 005 applied to local fixture database and both Neon environments. Live read-only credential/TLS/ledger audits passed; production remains empty.
- Existing development session 9644 reported twice with identical report ID and source version 717419c96131a938952397e5c9a168d27c4c8c0c2fa176be6b846f157b7ebad0. 940 laps, 836 pace/stint candidates, 104 excluded laps, zero hard findings and 49 warnings. Original source counts remain 1/20/940/59/39/37. No new OpenF1 downloads or source refreshes performed. No deployment performed.

Limitations: candidate is not certified green or a matched pair. Approximate source timestamps and incomplete race-control coverage limit certainty. Sector-yellow overlap cannot establish sector passage. Early driver coverage does not establish retirement. Exclusion counts overlap; use per-lap candidate counts. Older retained reports cannot replay pruned raw payloads. Local exports and database history retain latest 20 versions, not indefinite JSON copies. AI budget behavior does not exist yet.

Checkpoint: run data:quality -- 9644, inspect a lap's exclusions/evidence, explain warning versus hard failure and the effect of sample exclusions. See stage-5-quality.md. Next stage: await the user's numbered Stage 6 request; stop after Stage 5.

- Stage 5 implementation 65f45dd committed/pushed. Fresh GitHub CI passed app checks, all five migrations, role provisioning, fixture/schema/permission audit and versioned quality/retention integration on disposable Postgres: https://github.com/hsivasambu/f1-analytics-platform/actions/runs/37564501777. Existing user dependency/lockfile edits remain outside Stage 5 commits.

## Stage 6 - SQL learning workbook

Purpose: personally change explicit SQL filters, joins and windows and understand sample/NULL/calculation effects using the implemented schema.

Implemented:
- Ten progressively harder SQL lessons: session counts; driver coverage; fastest candidate with ties; continuous median; same-session/same-eligible-lap paired comparison; inclusive stint summaries; guarded LAG changes; trailing lap-number rolling pace; pit/control UNION ALL timeline; labelled pit-exclusion sensitivity.
- Separate sql/workbook/exercises.md, answers.md and answer SQL files, plus workbook README with exact commands, expected outputs, manual walkthrough, concept explanations and prediction questions. Exercises 5 and 8 provide the personal filter/join/window checkpoint.
- Shared CTE selects current published source version and quality-v1. CLI uses APP_DATABASE_URL, safe bound numeric parameters, fixed lesson files, existing timeouts and repeatable-read/read-only transaction. Reject missing report, hard quality failures, absent selected entries, invalid filters or identical driver selections. Output includes source/policy versions, sample counts and green status not established. No schema migration, source download, persisted metrics, UI/dashboard/chart/API/snapshot or AI added.
- Known fictional local fixture uses actual ingestion/schema/quality before querying. Guarded local test database only, empty start and cleanup afterward; --show prints predictions' results. CI adds sql:verify after existing ingestion checks. Raw source/provenance and production race data unchanged.

Verification actually performed:
- All ten lessons ran successfully read-only against current development session 9644: 940 laps/836 candidates, 20 entries, 59 stints, 39 pits and 37 control events. Drivers 1/44 each have 44 candidates but share 41 lap numbers; signed mean A-B=0.25707317073170731707 seconds and median=0.403 seconds. Pit-relaxed mode has 47 pairs and mean=0.24491489361702127660 seconds. Timeline retains 76 events. No performance/causal claim made.
- Local sql:verify and sql:verify -- --show passed: 13 fictional laps/eight candidates/one missing duration, zero-lap entry retained, odd/even medians and empty sample NULL, fastest ties, three matched pairs with mean -7/3 and median -3, unambiguous stint summary, adjacent eligible LAG, lap-number gap/full rolling-window checks, unknown event/service timestamps retained, pit-relaxed five-pair mean +2.6, preserved neutralization/boundary exclusions, zero matched samples and display-filter history.
- Intentionally removing lap equality produces 15 combinations and wrong-sample mean -47/15; intentionally replacing RANGE with ROWS bridges lap six and yields 293/3 instead of NULL at B lap seven. Both variations executed and checked, not merely described.
- npm run check passed lint, TypeScript, 29/29 existing tests and static production build. SQL arithmetic is verified separately with Postgres, not imitated in JavaScript. No deployment, paid service or AI API usage performed.

Limitations: current-report dependency; standalone answer files need context.sql; display output defaults to first 12 rows with truncation notice; numeric values retain pg precision as strings. Same-number laps can occur under different wall-clock conditions. Fuel/car/traffic/weather/tyres/selection are uncontrolled; raw means do not prove skill or causal degradation. Sensitivity is illustrative, not a replacement for quality-v1. Production remains empty and the app remains the runnable foundation without DB dependency.

Checkpoint: read exercises before answers, run sql:workbook -- --query 5, change range/driver pairing, then predict and inspect RANGE/ROWS differences in lesson 8. Next stage: await the user's numbered Stage 7 request. Stop after Stage 6.
