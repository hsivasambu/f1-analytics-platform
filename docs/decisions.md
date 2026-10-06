# Decisions

## D001 — Stage 1: minimal App Router foundation

Use Next.js/TypeScript, npm with exact direct dependency versions and a checked-in lockfile, plain CSS and system fonts. This minimizes setup and avoids a build-time font download. Tradeoff: charting and richer UI conventions remain undecided until their stage. No chart library or database driver is installed early.

## D002 — Evidence preparation separate from presentation

Plan ingestion and analytical SQL outside page components, then export a shared evidence contract into bundled snapshots. Tradeoff: later schema/version management and snapshot regeneration are required, but the demo can work without live services. This is a design direction, not an implemented data pipeline.

## D003 — Validation proportionate to the foundation

Use static page-rendering smoke tests plus strict types, lint and a real production build. CI uses read-only repository permissions. Tradeoff: this does not verify browser layout, future analytics, ingestion, database permissions or AI budgets. Those need meaningful tests when implemented.

## D004 — Historical source candidate

Propose OpenF1 for lap/stint/pit coverage, with Jolpica as a possible cross-check. Race choices wait for coverage and quality validation. Tradeoff: OpenF1's documented historical coverage starts in 2023, limiting older races. No paid or live subscription will be added.

## D005 — Compatible stable toolchain

Registry stable releases selected: Next.js 16.3.8, React/React DOM 19.3.0, TypeScript 6.0.3, ESLint 9.39.5. TypeScript 7 exceeds typescript-eslint's declared `<6.1.0` support; ESLint 10 exceeds the React/import/accessibility plugins' peer ranges. Therefore use the latest stable compatible majors rather than overriding peer contracts. ESLint 9 is marked deprecated by npm; revisit when Next's plugin chain supports ESLint 10.

`npm audit` reports five high-severity entries in the development-only `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces` chain ([advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)). Its offered fix downgrades to incompatible Next 14 tooling, so no forced downgrade or override is applied. These are not production runtime dependencies. Recheck compatible upstream fixes before deployment. Initial runtime installation audit reported zero vulnerabilities.

Type checking runs Next's type generation before tsc, so it works before the first dev/build invocation. The generated next-env.d.ts is ignored according to the bundled Next documentation.

## D006 — Bounded historical investigation before schema

Use built-in Node fetch plus TypeScript/tsx already installed; no extra service, token or dependency. Discover real sessions, probe the last three completed main races of a permitted historical year, then choose the first passing access/nonempty checks. Restrict lap probes to laps 1–5, extended laps to two discovered drivers with at most 100 laps each, and low-volume responses to hard byte/row caps. Tradeoff: observed coverage cannot establish full-race completeness. The 2024 candidates are after documented stationary-stop coverage began; nullable durations still need explicit treatment.

## D007 — Preserve separate investigation runs

Store unchanged JSON text with URL, filter, UTC retrieval time and SHA-256 provenance in timestamped gitignored directories. Publish only a reviewed derived profile, not raw API archives. Tradeoff: reruns use additional local disk and must be compared intentionally; they do not overwrite old evidence or insert duplicate database rows. No database ingestion exists yet.

## D008 — Retry with explicit limits

Sequential requests are spaced 1.1s apart; each logical query allows three attempts and a 20s timeout including body reads. Respect Retry-After up to 30s and retry only 429, selected transient server errors, network errors and timeouts. Stop on permanent access errors, malformed data or payload bounds. Tradeoff: a sustained outage requires a later manual rerun, and the CLI will not retry indefinitely. A 24-query logical budget caps the investigation (normally 19; at most 72 attempted requests).

GitHub repository created and initial foundation pushed to `https://github.com/hsivasambu/f1-analytics-platform` at the user's request. Raw records remain excluded from commits. No website deployment or paid service was enabled.

## D009 — Source-scoped entries and provisional UUID identities

Sessions use OpenF1 session keys; entries use (session_key, driver_number); laps/stints extend that pair with their source sequence number. Driver identities use internal UUIDs with unresolved status by default. An entry may have no resolved UUID. Names/acronyms/numbers are never unique person keys. Tradeoff: later cross-session person comparisons need reviewed identity linkage rather than an automatic number match.

## D010 — Conservative event content/occurrence keys

No stable pit/control event ID was observed. Use a database identity PK plus UNIQUE(session_key, SHA-256 of complete JSONB-text source object, duplicate occurrence rank within that response). Ordinal and rank come from the archived array, not caller assertions. All fields participate; same-time distinct content stays distinct, identical repeated objects remain separate occurrences, and exact replay keys fail. Tradeoff: source corrections/incomplete-response ambiguities need explicit future reconciliation; this is not real-world incident identity. Raw observations remain available. No production ON CONFLICT loader exists yet.

## D011 — Exact source projections with modest constraints

Use unconstrained-scale numeric seconds and timestamptz for source instants, retaining the original JSON response text and object. Keep unknown fields NULL; source arrays and unrecognized category/compound text survive. Reject negative/nonfinite durations, enforce source key/provenance relationships, but do not assert exact sector sums, alias equality, stint range ordering or race-control session bounds. Tradeoff: quality anomalies need profiling instead of being universally rejected; extra raw storage consumes the Free storage allowance.

## D012 — Three credential purposes and separate environments

Migration credentials perform explicit DDL/provisioning. SQL-created ingestion/app logins inherit NOLOGIN privilege groups: ingestion can write typed projections and append source observations, while the app can only SELECT typed tables. Both lack admin/DDL/temp privileges; the app cannot read raw/migration tables. No credentials reach browser variables, Git, CI or chat. User-created development/production targets now have distinct Neon endpoints, applied migrations and verified restricted connections. Console subsequently confirmed two independent named Free projects, with endpoints matching the local env files, Postgres 18 and five-minute scale-to-zero. Published Free limits were checked; no upgrade was selected.

## D013 — Explicit, checksum-tracked SQL migrations and disposable verification

Keep versioned SQL files and LF line endings. A direct Postgres client takes an advisory lock, runs each unapplied file and ledger entry in one transaction, and refuses missing/changed migration history. New versions modify earlier behavior instead of silently editing applied SQL. Fixture/verification commands are development-only and roll back synthetic rows; identity sequence counters can still advance. CI has a disposable Postgres service and test-only credentials. Tradeoff: these scripts require a schema-owning migration account; pooled/HTTP endpoints and automatic app-start migration are not used.

## D014 — Read-only production audit

Use `db:audit -- --env production` to check live credential identity, endpoint/database consistency, TLS certificate authorization, ledger and restricted ACLs in read-only transactions. Exercise failing writes and synthetic rows only through development verification. Tradeoff: production ACL inspection does not execute denied writes, while development supplies the behavioral permission tests. Inspect the client's TLS socket rather than the backend SSL statistics behind Neon's proxy.
