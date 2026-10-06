# Stage 4 — one-race ingestion

## Purpose and main concept

Ingestion turns source responses into stored, traceable rows. A refresh must act like replacing a whole book: readers see the previous edition until the new edition is ready. The CLI fetches six bounded historical responses, validates them, loads private staging, and asks Postgres to publish all relational rows and provenance in one transaction. Failure rolls that transaction back. The application still does not read the database.

Stage 4 deliberately permits only **Las Vegas 2024, session 9644**, discovered and investigated in Stage 2. The CLI accepts the key explicitly and rejects other keys before opening a connection. Extending the allowlist requires a later reviewed coverage decision, not a season download.

## Actual order: ELT

1. **Extract:** retrieve `sessions`, `drivers`, `laps`, `stints`, `pit`, `race_control` using exactly `session_key=9644`, without lap/driver filters.
2. Validate object arrays, sizes, source keys, types, natural-key uniqueness, driver joins, timezone-bearing timestamps, completed race metadata and nonempty endpoints. Unknown fields remain in raw JSON; absent and null mapped fields become SQL NULL, never zero.
3. **Load:** insert original response text into private `f1_ingest.staged_payloads` inside a transaction; archive response text and individual objects with hashes/ordinals.
4. **Transform:** explicit SQL projects JSONB into numeric seconds, timezone-aware timestamps and typed relational tables. Source key/FK/check triggers validate the projection.
5. Atomically commit the new dataset version, success status and retention changes. Failed attempts retain compact diagnostics but no staged/raw copies.

This is **ELT with validation before loading**. Transformation into relational values happens in Postgres after raw staging, rather than transforming all records into cleaned rows before loading them.

## Exact commands

From the repository root, with the existing ignored environment files:

```powershell
npm ci
npm run db:migrate
npm run data:ingest -- 9644
npm run data:ingest -- 9644
npm run data:inspect -- 9644
npm run db:verify
npm run check
npm run dev
```

`db:migrate` should print four applied/already-applied versions. Each ingestion prints six endpoint counts, a succeeded run, its data version and source-object change counts. A byte-identical second fetch reports `same_version: true`, zero source-object additions/removals and the same version. Different upstream bytes can legitimately publish a new version, including JSON ordering/format changes.

Actual development results on October 6, 2026: **1 session, 20 entries, 940 laps, 59 stints, 39 pit events, 37 race-control events**. Both live runs succeeded with identical version `717419c96131a938952397e5c9a168d27c4c8c0c2fa176be6b846f157b7ebad0`. Inspection found **six retained payloads and 1,096 source records** after the second run. Of the 940 lap observations, 937 have known durations and three are NULL. These are computed source coverage counts, not an assertion that every real-world lap or incident is documented.

`data:inspect` opens a read-only migration-owner connection because it includes private provenance. It prints counts, dataset metadata and driver 1/lap 1's source object, request URL, response checksum, source ordinal, run ID and version. Typed duration `106.37` seconds matches the source observation; its original timestamp string is retained. The app reader cannot retrieve raw payloads.

The production schema also has migration 004, but **production remains empty**. No website deployment occurred. The explicit production CLI option exists for a later authorized run; no production race import was performed here.

### Manual walkthrough

1. Run ingestion twice, compare the two versions and change summaries.
2. Run inspection. Follow `source_record_id → source_records.payload_id → source_payloads.run_id → ingestion_runs`, using the example in `sql/examples/lap_provenance.sql`.
3. In Neon SQL Editor, select the development project before running the exercise below. Use the migration-owner role for private provenance queries.
4. Start the app and visit `/` and `/methodology`. They remain runnable without database reads and show no ingestion button/public write endpoint.

## Refresh, concurrency and retention rules

- A session advisory lock serializes the entire fetch/publication lifecycle. Fetching holds no database transaction. Source payloads are at most 2 MB and 2,000 rows each; at most six logical requests/18 HTTP attempts, with 20-second request timeouts, bounded retries and 2.1-second spacing. A local CLI is rate-limited independently; separate machines/processes outside this database must also respect OpenF1 limits.
- All six endpoints must return nonempty, valid full-session responses. Missing endpoints, malformed arrays, type/key/join errors and SQL constraints fail the attempt. No missing measurement is estimated.
- A byte-identical version retains the original successful dataset pointer and raw objects; the new run stores retrieval metadata and a no-change result. Dataset publication time means when those bytes became the dataset, not the latest no-change check.
- A changed successful response **replaces** this session's entries/laps/stints/pit/control rows. Rows absent from the new complete response are deleted. A corrected source object counts as one removal and one addition. Multiset comparison preserves identical event occurrence counts. The run records previous/current endpoint counts and per-endpoint added/removed source-object counts. Generated event IDs can change; source-content keys are the comparison identity, not physical incident identity.
- No cross-season driver identity is inferred. Entries remain unlinked to UUID driver identities. Refresh refuses existing linked identities until a reviewed mapping policy exists.
- Retain **only the latest successful six raw payloads and their source records** for this one curated session. On success, prune superseded payloads in the same transaction after all typed references have moved. Retain latest **20 compact run summaries plus the protected dataset-origin run** if it is older: at most 21 completed summaries. Failed runs retain bounded errors/partial endpoint checksums and counts, not duplicate JSON bodies. Staging empties on commit or rollback. A process killed mid-run leaves `running` metadata until the next lock-holding CLI marks it interrupted/failed and retries.
- Existing Stage 2 local investigation archives are preserved and outside the Stage 4 refresh path. Stage 4 creates no additional local raw files. Database pruning reuses space; it does not immediately reduce provisioned disk usage.
- The ingestion role still has no general DELETE, DDL or TEMP rights. Fixed-search-path SECURITY DEFINER functions provide the narrowly scoped publication/failure cleanup operations. The migration owner can delete archive rows for retention; UPDATE remains rejected. The app role cannot execute those functions or read staging/raw tables.
- Postgres makes each committed refresh atomic. A future API reading multiple related queries will need a consistent read transaction; no such API is implemented here.

Published source access/rate terms were checked against [OpenF1](https://openf1.org/): historical requests are free without authentication, up to 3 requests/second and 30/minute. No live subscription or paid service was added.

## Verification and tradeoff

`db:verify-ingestion` exercises real restricted connections and committed transactions in a **dedicated local test database**, never Neon. It tests identical loading twice, duplicate event multiplicity, invalid input, endpoint outage, SQL projection failure, unchanged prior dataset after each failure, reader visibility before commit, corrections/deletions, raw provenance joins and bounded history across 22 further repeats. It checks denied app publication/general ingestion deletion, then removes only synthetic rows from the guarded local test target. CI uses a fresh disposable Postgres service, without Neon secrets.

Optional local rerun using the preserved Stage 3 Docker owner env file/container:

```powershell
docker start f1-analytics-stage3-dev
npm run db:setup-ingestion-test
npm run db:verify-ingestion
```

Setup creates `f1_stage4_test` in that local container, its own restricted test logins and gitignored `.env.ingestion-test.local`; it refuses to reset an existing test password whose file is missing. It leaves other databases unchanged. CI copies its disposable `f1_test` credentials to the ignored test file instead.

**Decision/tradeoff:** authoritative whole-session replacement makes removals explicit and rollback simple, and bounded retention avoids indefinite JSON growth. It sacrifices full historical source-version replay. A syntactically valid but incomplete upstream full-session response cannot be proven complete by this API; nonempty/key/join checks do not detect every omission. Counts and source-object changes reveal changes for review. Linked identities require a reviewed refresh mapping rather than silent reassignment.

## Two learning exercises — try before reading answers

1. **SQL/data quality:** count all lap rows, known durations and missing durations for this session. Explain why `COUNT(lap_duration)` differs from `COUNT(*)`; then trace one cleaned lap using the provided join example. Use development SQL Editor:

```sql
SELECT COUNT(*) AS total, COUNT(lap_duration) AS known,
       COUNT(*) FILTER (WHERE lap_duration IS NULL) AS unknown
FROM f1.laps WHERE session_key = 9644;
```

2. **Failure/idempotency:** note the version from `data:inspect`, run `npm run data:ingest -- invalid`, then inspect again. Explain why the dataset does not change, and why a second valid successful run can create a new run record while retaining the same dataset/raw rows. Read the integration test's simulated SQL failure for the stronger rollback case; do not manually damage the real race.

### Answers — read after attempting

1. The verified SQL result is total **940**, known **937**, unknown **3**. `COUNT(column)` excludes NULL, which represents an unknown duration; zero would still count as known. Provenance joins return the retained source object/ordinal and response/run/version. With parameters `(9644,1,1)`, the observed duration is **106.37** seconds, ordinal **7** in the laps response.
2. Invalid CLI input fails before connecting or fetching. A successful no-change run proves another retrieval attempt succeeded while the dataset's source bytes/version remain unchanged. The integration test proves a later SQL failure rolls back the staged/archive/typed changes and records failure separately, leaving the prior committed laps visible.

Checkpoint: one real race is ingested twice in development without count/raw inflation; its laps are traceable. Await the user's numbered Stage 5 request. No race analytics, charting, DB-backed app API, snapshots or AI were added.
