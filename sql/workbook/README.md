# Stage 6 SQL learning workbook

SQL describes how to select and combine records; Postgres performs the calculations. These ten lessons query the implemented schema and Stage 5 eligibility, not invented database tables. Work through [exercises](exercises.md) before opening [answers](answers.md) or `answers/*.sql`.

## Setup and commands

From the repository with Node 22.18+ and existing ignored development env files:

```powershell
npm ci
npm run sql:workbook
npm run sql:workbook -- --query 5 --driver-a 1 --driver-b 44
npm run sql:workbook -- --query 5 --from-lap 20 --to-lap 40
npm run sql:workbook -- --query 8 --limit 100
```

Defaults: session 9644, drivers 1 and 44, lap range 1–1000, all ten queries, first 12 result rows displayed. `--query` accepts 1–10 or all; `--limit` accepts 1–2000. Header prints actual source/policy versions and filters. PostgreSQL numeric/bigint values can display as quoted strings because the Node client preserves precision; no durations are rounded or replaced with zero.

Use existing `APP_DATABASE_URL`, not owner/ingestion credentials. The runner performs a consistent read-only transaction with parameterized values, fixed lesson paths and existing timeouts. It requires both selected session entries and one current `quality-v1` report with no hard failures. If the report is missing, use Stage 5 `npm run data:quality -- 9644` first. No migration, schema, source refresh or app feature is added in Stage 6. Production is empty and is not a useful workbook target; the optional `--env production` remains read-only.

Known-fixture verification uses only the existing dedicated local Docker/Postgres test database:

```powershell
npm run db:setup-ingestion-test
npm run sql:verify
npm run sql:verify -- --show
npm run check
npm run dev
```

Expected `sql:verify`: PASS for all ten lessons, counts/NULLs/percentiles, matched samples/sign, stints, LAG, rolling windows, events, sensitivity, zero matches and ties. `--show` prints baseline fictional query results before assertions. Setup requires the existing Stage 4 local Docker container/env, not Neon. The verifier refuses nonlocal/non-test database URLs and nonempty session tables, ingests a tiny fictional fixture through the actual pipeline, queries with restricted app credentials, then cleans up its fixture. It uses owner/write credentials only in that guarded disposable database. CI uses fresh Postgres without Neon secrets. `check` runs lint, types, 29 existing unit/smoke tests and build; SQL assertions are separately run by `sql:verify` and CI.

Open http://localhost:3000 and /methodology to confirm the app still runs. Then read exercise 5, predict its result, run query 5, change the lap filter and rerun. For window exercises, edit the indicated SQL file, predict the change, run query 8 and restore the original expression. Changed SQL executes only with read-only permissions. Running `sql:verify` after an intentional change can fail an expected-value assertion: that demonstrates the semantic difference.

## How the files fit

`context.sql` defines shared CTEs, prepended to each answer file by the runner. A CTE is a named query result within one SQL statement, not a persisted table. `p` has parameters; `current_report` joins the published source version to the matching policy version; `observations` joins typed laps to their assessments; `range_laps` applies the selected lap bounds. Parameter order: `$1` session, `$2` A, `$3` B, `$4` first lap, `$5` last lap, `$6` quality policy. To use a SQL editor, combine context and one answer, replacing just these parameter values with typed literals locally. Never paste connection strings into a query or chat.

Lessons 1 and 9 intentionally cover the entire session. Lessons 2–6 and 10 use the lap range. Lessons 7–8 compute history on the entire session before filtering the displayed range, so the first displayed lap can use preceding history. Only lessons 5, 7, 8 and 10 restrict calculation/output to selected A/B; other driver summaries show all session entries.

Matched comparison means an inner join of the **same session and lap number**, eligible for **both drivers**. The mean is A seconds minus B seconds over exactly that shared sample. Negative means A took fewer recorded seconds on those laps. Sample count, individual eligible counts and exact matched lap numbers accompany the result. Same lap number need not mean the same wall-clock track conditions, especially for lapped cars. Fuel, traffic, car, tyre state, weather and selection effects remain uncontrolled. Raw averages do not establish driver skill, and stint summaries do not establish causal tyre degradation.

Rolling pace is a descriptive trailing three-lap-number mean. Partial available means are labelled and counted; the complete mean is NULL unless all three consecutive lap numbers are observed and eligible. LAG changes compare only adjacent eligible lap numbers. No significance threshold, prediction or causal claim is added. Green-flag certification remains not established.

## Actual read-only run: October 6, 2026

Source version `717419c96131a938952397e5c9a168d27c4c8c0c2fa176be6b846f157b7ebad0`, policy `quality-v1`, default full range:

- 940 laps, three missing durations, 836 candidates; 20 entries, 59 stints, 39 pit and 37 control events.
- Driver 1 fastest candidate: lap 43, 96.248 seconds; median over 44 candidates: 97.634 seconds.
- Drivers 1/44: 44 candidates each, 41 shared lap numbers; mean A−B = 0.25707317073170731707 seconds, median A−B = 0.403 seconds.
- Changing query 5 to laps 20–40 gives 18 shared lap numbers and mean A−B = 0.59011111111111111111 seconds; the sample changed, not just its display.
- Pit-relaxed sensitivity: 47 shared laps, mean A−B = 0.24491489361702127660 seconds. This is an exclusion experiment, not representative clean pace.
- Timeline retains all 76 source events; no inference that a timestamp assigns a race-control notice to an affected lap.

These outputs were actually computed, not hardcoded into the runner. Future source/policy versions can change them. The fixture is explicitly fictional and never published to Neon.

Design decision: visible SQL files plus a shared version-selection CTE keep calculations editable and prevent mixed-version joins. Tradeoff: files depend on that context and the current quality policy; they are learning queries rather than app APIs or stored analytics. No dashboard, chart or AI is implemented.

Checkpoint: change a filter, join or window, predict the difference, run it, and explain its sample and limitations. Stop after Stage 6.
