# Stage 5: quality and analysis eligibility

Quality checks recorded observations; eligibility applies an explicit comparison policy without deleting them. A candidate is not a matched driver pair or certified green-flag lap.

## Commands and walkthrough

Use Node 22.18+, existing ignored development credentials, and the existing local Docker/Postgres fixture setup:

```powershell
npm ci
npm run db:migrate
npm run data:quality -- 9644
npm test
npm run db:setup-ingestion-test
npm run db:verify-ingestion
npm run check
npm run dev
```

Migration output lists applied/already-applied files through 005. Quality prints counts, versions and the full JSON path in ignored data/reports. Repeat runs upsert the same report and overwrite the same export. Expected tests: 29 passing tests, integration PASS, then successful lint/types/build. The fixture verifier refuses nonlocal or non-test targets. Open http://localhost:3000 and /methodology: the foundation remains runnable without database access. This stage adds no public write API or quality UI.

Open the report JSON and inspect summary, findings, control_windows, and laps. Select the current source/policy version in SQL rather than mixing historical reports:

```sql
SELECT a.driver_number,a.lap_number,a.lap_duration,
       a.exclusions,a.warnings,a.evidence,a.green_flag_status
FROM f1.session_datasets d
JOIN f1.quality_reports q
 ON q.session_key=d.session_key AND q.data_version=d.data_version
JOIN f1.lap_assessments a USING(report_id)
WHERE d.session_key=9644 AND q.quality_version='quality-v1'
 AND a.driver_number=1
ORDER BY a.lap_number;
```

Driver 1 lap 11 is excluded by the pit event's source lap number; lap 12 is pit-out and overlaps its timestamp. Preserve both evidence forms when approximate timing and source lap labels disagree. Current assessments trace through source_ordinal to source_records.source_ordinal in the laps payload of session_datasets.run_id (use the Stage 4 provenance guide). Older reports retain compact references but cannot replay pruned source payloads.

## Actual development report: October 6, 2026

Source version: 717419c96131a938952397e5c9a168d27c4c8c0c2fa176be6b846f157b7ebad0. Policy: quality-v1.

| Measure | Count |
|---|---:|
| Source laps | 940 |
| Hard integrity findings / warnings | 0 / 49 |
| Pace candidates / stint candidates | 836 / 836 |
| Excluded laps | 104 |
| Missing durations / unmappable intervals | 3 / 3 |
| Pit source-lap / timestamp / pit-out reasons | 39 / 39 / 39 |
| Race-start / explicit deleted-time reasons | 20 / 8 |
| No known interruption / unmappable control states | 937 / 3 |

Reasons overlap: do not sum reason counts to obtain excluded laps. Warnings: 39 pit lap/time disagreements, four early driver coverage endings, three missing durations, two unmatched stint assignments, one unresolved deleted-lap notice. Four laps additionally carry blue-flag warnings. No source safety-car/red window was observed, which does not establish complete coverage. The recorded sector-yellow begins after session coverage and is not mapped backward.

## Policy, uncertainty and tradeoff

Duplicate natural keys, broken session/driver references, invalid durations and source/projection manifest mismatches are hard failures: all candidates are blocked, while evidence remains. Empty endpoints, missing records, short driver histories, duration gaps and ambiguous stints are warnings. Fewer laps do not establish retirement; an explicit driver retirement message is separate evidence, not a completeness certificate.

Intervals are half-open [start,end). Positive duration plus source start defines the usual end; the next consecutive start can supply a labelled estimate when duration is missing, but that lap remains excluded. Recognized safety-car/VSC deployment-to-end and track-red-to-resume windows imply neutralized overlap. Pending ending messages, DRS changes and pit-exit green lights do not end neutralization. Unclosed windows extend conservatively to observed session/lap coverage. Unrecognized state messages remain findings.

A manually selected one-second review buffer is not a measured timestamp error bound. Adjacent laps may be excluded as possible interruption without being labelled neutralized. Yellow flags remain separate warnings and are excluded by default. Sector-yellow overlap cannot establish that a driver passed that sector under yellow; source sector identifiers can describe mini-sectors. Driver-scoped flags apply to their driver; unknown scopes remain conservative. Blue flags warn without automatic exclusion. Deleted times require explicit car/lap identifiers; delayed announcement time never identifies the affected lap.

[Official OpenF1 documentation](https://openf1.org/docs/) describes approximate lap starts, inclusive stint boundaries and race-control timestamps/scopes. These fields do not establish exhaustive green-track coverage. Every assessment has green_flag_status=not_established. Future comparisons must intersect candidates for the selected drivers and display sample counts; no pace metric is computed here.

Design decision: conservative exclusions reduce sample size and can exclude usable laps, but avoid false precision from approximate timestamps. Keep latest 20 database reports per curated session and latest 20 local exports per environment/session; same-version repeats do not grow history. Raw retention remains latest-successful-only. Source/typed observations are never removed by eligibility.

## Exercises

1. SQL: count current assessments, candidates and exclusions using COUNT(*) FILTER and the version join above. Why does counting individual reasons overcount excluded laps?
2. Boundary reasoning: laps [0,60), [60,120), [120,180), safety-car window [60,120). Predict strict overlap and uncertain adjacent exclusions with the one-second policy. Inspect the corresponding synthetic test in tests/quality.test.tsx and run npm test.

## Answers: read after attempting

```sql
SELECT count(*) AS laps,
 count(*) FILTER (WHERE a.pace_candidate) AS candidates,
 count(*) FILTER (WHERE NOT a.pace_candidate) AS excluded
FROM f1.session_datasets d
JOIN f1.quality_reports q
 ON q.session_key=d.session_key AND q.data_version=d.data_version
JOIN f1.lap_assessments a USING(report_id)
WHERE d.session_key=9644 AND q.quality_version='quality-v1';
```

Current answer: 940, 836, 104. Multiple reasons can apply to one lap. Only the middle interval strictly overlaps neutralization; adjacent intervals are possible boundary overlaps and conservatively excluded. Lap one also has a race-start exclusion. None is certified green.

Checkpoint: explain an exclusion and its evidence, distinguish uncertainty from corruption, and describe how the candidate sample affects a comparison. Stop here; Stage 6 awaits the user's numbered request.
