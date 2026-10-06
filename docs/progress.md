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
