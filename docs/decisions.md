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
