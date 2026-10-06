# Architecture — implemented through Stage 3

## Stage 1 foundation

Next.js App Router and TypeScript render `/` and `/methodology` using local content and CSS. There are no app API routes, external requests, secrets, data stores, metrics or AI calls. Both pages can be built statically. ESLint, TypeScript, Node test runner through tsx, and Next production build form the verification workflow. GitHub Actions runs the same checks; verified remote outcomes are recorded in progress.

## Proposed later data flow (not implemented)

Historical source APIs → Node/TypeScript ingestion → preserved raw payloads and provenance → normalized Postgres tables → explicit analytical SQL → versioned evidence snapshots → app charts and explanations.

- **Ingestion:** scripts fetch only curated historical sessions, handle pagination/rate limits, retain source URL, retrieval time, raw payload and content hash. Later idempotent upserts and quality checks should make reruns safe.
- **Postgres:** Neon Free will hold normalized race/session, driver, lap, stint and pit records. Explicit SQL migrations belong in `sql/migrations`; source identifiers and raw values remain traceable. Account setup, access roles and free-plan verification are deferred.
- **Analytical SQL:** named queries in `sql/queries` calculate comparisons and exclusions with documented units and definitions. The UI and AI consume the same computed evidence; neither invents figures.
- **App APIs:** future server handlers expose validated read-only operations, fixed queries and bounded parameters. Database credentials remain server-side; no browser SQL or public write path.
- **Bundled snapshots:** generated, versioned JSON carries computed values, provenance, filters, missing-data labels and evidence IDs for three curated races. A later build must remain useful without a database or AI. Snapshots do not exist yet.
- **AI tools:** a later optional server-side explainer retrieves bounded evidence through allowlisted tools, cites evidence IDs, shows tool activity and enforces a spending/request cap. No arbitrary SQL, data mutation or private reasoning display. A deterministic explanation fallback will support the public demo.

## Version 1 boundary

Target: a public, login-free demo with three curated historical races, driver comparisons, accessible mobile-friendly charts and evidence-linked explanations. Race selection depends on source coverage validation. Historical descriptive analysis only. Exclude live timing, betting, video, car-position animation, full telemetry, optimization, predictions and certain counterfactual claims. Missing information is labeled; an exclusion is visible rather than silently deleting raw data.

Use Next.js/TypeScript, Node ingestion, explicit SQL, Neon Free, GitHub and Vercel Hobby. Select a lightweight chart library only when charts are needed. Verify official free-plan terms at deployment; never enable an upgrade automatically. No hosting URL was present in the inspected directory or request; resolve it at the deployment stage. Nothing is deployed in Stage 1.

## Proposed folder structure

Only folders marked existing are created:

```text
src/app/                 existing: pages, layout, styles
src/components/          future: charts, controls, evidence views
src/lib/server/          future: database access and validated evidence services
src/lib/analytics/       future: typed output contracts and helpers
src/lib/ai/              future: allowlisted tools and budget enforcement
scripts/ingest/          future: Node/TypeScript source adapters
scripts/snapshots/       future: evidence export
sql/migrations/          future: schema changes
sql/queries/             future: analytical calculations
data/raw/               future: preserved source payloads (storage policy TBD)
data/snapshots/         future: bundled public evidence
tests/                  existing: page rendering smoke tests
docs/                   existing: implementation and learning records
.github/workflows/      existing: CI definition
```

## Stage 2 — implemented investigation layer

`scripts/openf1/core.ts` implements bounded historical HTTP access and field/key profiling; `scripts/openf1/cli.ts` discovers race sessions, probes three candidates and samples two drivers from the first candidate passing endpoint checks. These scripts run locally, outside the app. No database schema, SQL analytics, application API or AI is implemented.

Raw JSON text and a URL/retrieval-time/hash manifest are archived per run in gitignored `data/raw/openf1`. Low-volume driver/stint/pit/control responses cover three candidates; extended lap sampling covers only one race. Derived field profiles and join checks are generated locally, with a reviewed result in `docs/openf1-profile.md`. See `docs/stage-2-investigation.md` for exact bounds and actual findings. The original proposed ingestion and snapshot locations remain future designs; this is investigation, not production ETL.

## Stage 3 — schema and database tooling

Implemented schemas: `f1` (typed sessions, provisional drivers, session entries, laps, stints, pit/control events); `f1_ingest` (runs, immutable raw responses and source-array records); `f1_meta` (migration version/checksum ledger). Three versioned SQL migrations create tables, indexes, restricted role groups and source-key guards. The data dictionary describes actual columns and relationships.

`scripts/db` provides explicit migration, restricted-login provisioning, rollback-only synthetic fixture and database-verification commands. No schema/role action happens at application startup. Development and production Neon direct endpoints are provisioned and audited; the former local Postgres 18 container remains available on localhost:15432. Console confirms two independent Free projects, Postgres 18, Ohio region, 0.25–2 CU compute and five-minute scale-to-zero. Separate gitignored development/production environment files select targets. Migration credentials own schema changes; the ingestion login has scoped DML without archive mutation; the application login can only SELECT typed tables and cannot access raw or migration schemas.

The app remains independent of Postgres. No production ingestion mapper, historical race loading, SQL race metrics, DB-backed routes, snapshots or AI tools are implemented. CI uses disposable Postgres to check migrations and real login permissions; it never receives local or Neon credentials. SQL teaching examples apply to synthetic fixtures only. See `stage-3-database.md` for exact commands, current setup and verified Console settings.

## Stage 4 implemented ingestion

`scripts/ingest/cli.ts` accepts investigated session 9644 and an explicit environment. It extracts six full-session responses with bounds, validates keys/types/joins, loads private staging/raw provenance, then projects typed rows in SQL through migration 004's atomic publication function. This is ELT with pre-load validation. `session_datasets` identifies each published version; metadata records checksums/counts/errors and replacement changes. Latest raw payloads plus bounded run history replace indefinite copies. Development contains Las Vegas 2024; production remains empty. The app has no DB-backed routes or ingestion control. See `stage-4-ingestion.md` for actual commands, retention, recovery and limitations.
