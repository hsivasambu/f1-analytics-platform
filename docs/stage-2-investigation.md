# Stage 2 — OpenF1 investigation

## Purpose

Learn what real records mean before designing tables. A record's **grain** describes what one row represents. A lap row represents one driver's numbered lap in one session, not a whole race or one driver across all races. Profiling exposes missing values and plausible join keys; it does not certify source completeness.

## Run (PowerShell)

```powershell
npm ci
npm run data:discover -- 2024
npm run data:investigate -- 2024
npm run check
```

Discovery downloads only race-session metadata for the specified historical year and prints real session keys. Investigation checks the last three completed races chronologically, then selects the first with successful, nonempty responses from all five data endpoints. No keys or drivers are hard-coded. Supported years: 2023, 2024, 2025. There is no live or telemetry mode.

Expected for the verified 2024 run: 24 session metadata rows, candidate keys 9644/9655/9662, selected session 9644 (Las Vegas), drivers 1 and 4, 50 lap records per driver and 19 queries. Future source corrections may change counts. A new timestamped directory is printed each run:

```text
data/raw/openf1/<year>-<UTC-run-time>/
  discovery-sessions.json
  coverage-<session>-<endpoint>.json
  sample-<selected>-sessions.json
  sample-<selected>-laps-driver-<number>.json
  manifest.json
  coverage.json
  profile.json
  profile.md
```

The drivers, stints, pit and race-control sample uses the already-downloaded selected coverage payloads; files are not fetched again or silently renamed. `profile.md` is readable; `profile.json` includes structured observations. `manifest.json` records exact URLs, filters, retrieval times, SHA-256 hashes, byte and row counts and request attempts. Responses are saved unchanged as UTF-8 JSON text. Partial successful responses remain available if a later request fails. Raw files are gitignored. A reviewed derived profile is committed in [openf1-profile.md](openf1-profile.md), not served by the app.

Bounds: at most three race coverage probes; laps 1–5 for all drivers in each probe; at most two selected drivers and 100 laps each. Drivers, stints, pit and race-control are low-volume whole-session responses, capped at 2,000 rows and 2 MB per response. At most 24 logical queries (normally 19), each with at most three attempts and a 20-second request/body timeout. Sequential requests start at least 1.1 seconds apart. Retry 429 and temporary 500/502/503/504 or network/timeout failures; respect Retry-After up to 30 seconds, otherwise stop with a clear error. Permanent access errors, malformed payloads and exceeded size bounds stop that endpoint immediately. No authentication or paid subscription is used.

If the API is unavailable, the CLI exits nonzero, identifies the URL/error/attempt and preserves available evidence. Inspect `coverage.json` when no candidate passes. Do not interpret access failure as absence of race data. Avoid repeated reruns during an outage.

## Manual walkthrough

```powershell
$run = Get-ChildItem data/raw/openf1 -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'profile.json') } | Sort-Object Name | Select-Object -Last 1
Get-Content (Join-Path $run.FullName 'profile.md')
$laps = Get-Content (Join-Path $run.FullName 'sample-9644-laps-driver-1.json') -Raw | ConvertFrom-Json
$laps | Select-Object -First 3 session_key,driver_number,lap_number,lap_duration,is_pit_out_lap
Get-Content (Join-Path $run.FullName 'manifest.json')
git check-ignore data/raw/openf1/example.json
```

Use the session/driver printed by your run if it differs. Expect the ignore check to print the path. Read raw JSON directly for exact timestamp strings: PowerShell may convert parsed ISO date strings to local DateTime values. Identify the first lap's session, driver and lap number, then locate that driver in `coverage-9644-drivers.json` and a covering lap range in `coverage-9644-stints.json`. Do not join on driver number alone across sessions.

## Findings and candidate demo races

Observed on October 5, 2026 (Toronto); raw retrieval timestamps are UTC. Sessions discovered via `sessions?year=2024&session_name=Race`; all three candidates had past end dates, were not cancelled and contained a CHEQUERED race-control message. The following counts were computed from actual API responses, not copied from race narratives:

| Candidate | Session key | Drivers | Laps 1–5 | Stints | Pit events | Control messages | Null stop_duration |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Las Vegas, 2024-11-24 UTC | 9644 | 20 | 100 | 59 | 39 | 37 | 1 |
| Qatar / Lusail, 2024-12-01 UTC | 9655 | 20 | 92 | 82 | 60 | 112 | 33 |
| Abu Dhabi / Yas Marina, 2024-12-08 UTC | 9662 | 20 | 96 | 48 | 28 | 131 | 0 |

Propose these three because every required endpoint was accessible and nonempty, and they expose different coverage tradeoffs. Las Vegas offers a modest-sized first investigation, with one unavailable stationary duration. Qatar offers more stint/pit/control records but 33 missing stationary durations; this is useful for testing transparent missing-data treatment, not suitable for claiming complete stop-time comparisons. Abu Dhabi has no null stationary durations in its 28 observed pit records but still needs full-lap validation. The shorter opening-lap counts for Qatar and Abu Dhabi must be investigated rather than filled to 100. These are candidate demos, not final validated analytical datasets. Only Las Vegas has the extended two-driver lap sample.

For Las Vegas: all 100 sampled lap durations are numeric; one first-sector value and 15 first-intermediate speeds are null. All sampled candidate lap keys are unique; all 100 laps join one driver and exactly one stint. There are 48 numeric zero tyre ages: zero is a real source value, unlike null. Profiles cover top-level fields; array element nulls are preserved but not counted as field nulls.

## Pit and race-control interpretation

[Current official OpenF1 documentation](https://openf1.org/docs/#pit) defines `lane_duration` as pit-lane time, `pit_duration` as its deprecated alias, and `stop_duration` as stationary time, available from the 2024 US GP onward. The sample has no mismatches between numeric lane_duration/pit_duration pairs. Do not relabel lane duration as service time, assume a null stop means zero, or infer tyre changes from a pit event alone. A pit visit can include other activity; the source does not explain intent.

[Race-control docs](https://openf1.org/docs/#race-control) describe UTC message timestamps, categories and scopes. Las Vegas has Drs=2, Flag=10, Other=23, SessionStatus=2; 32 of 37 driver references and 27 scopes are null. Its first message is before scheduled session start. Timestamps are message records, not guaranteed exact incident onset or duration. Several messages can share a timestamp; a timestamp alone is not a reliable key. Preserve the message and nullable driver, lap, flag, scope and sector. Qatar includes eight SafetyCar-category records and Abu Dhabi two; category records are not counts of distinct safety-car periods. Do not create exclusion intervals yet.

[Lap docs](https://openf1.org/docs/#laps) label `date_start` approximate. The docs say mini-sector segments are unavailable during races, yet this sample contains arrays. Preserve this discrepancy and do not build race analytics on these undocumented-in-race values. No fuel load, traffic impact, driver intent, causal degradation or certain alternative strategy outcome is established by these responses.

## Two learning exercises

1. **Inspect source grain and missing values.** Find a Las Vegas pit record with null `stop_duration` and compare its lane duration with a non-null stationary duration on another record. Explain why replacing null with zero would change the meaning. Then identify the three fields that distinguish a sampled lap.
2. **Practice a SQL join design, without installing Postgres.** Suppose future `laps` and `stints` tables keep the source field names. Write a LEFT JOIN that attaches a stint to each lap using session, driver and inclusive lap range. Explain why LEFT JOIN is useful for detecting unmatched laps and why joining only on driver_number is unsafe. This is a scratch exercise, not a migration or implemented query.

### Answers — try the exercises first

1. In the observed Las Vegas sample, driver 31's pit visit on lap 11 has `lane_duration=15.7` and `stop_duration=null`. Driver 14's lap-4 visit has lane duration 21.407 seconds and stationary duration 2.6 seconds. Null means no stationary measurement supplied; zero would assert a measurement. Lap identity is session_key + driver_number + lap_number.
2. A candidate query is:

```sql
SELECT l.session_key, l.driver_number, l.lap_number,
       s.stint_number, s.compound
FROM laps AS l
LEFT JOIN stints AS s
  ON s.session_key = l.session_key
 AND s.driver_number = l.driver_number
 AND l.lap_number BETWEEN s.lap_start AND s.lap_end;
```

Unmatched laps remain visible with null stint fields. Driver numbers recur across sessions, and multiple stints occur per driver; an incomplete join multiplies unrelated rows. Inclusive ranges are a candidate interpretation requiring overlap/gap checks; all 100 sampled laps matched exactly one range here.

## Important design decision

Probe endpoint access before selecting a race, and reuse the low-volume payloads while extending laps for only two discovered drivers. This avoids full-season downloads and preserves evidence for rejected candidates. Tradeoff: early-lap coverage plus nonempty endpoints cannot certify full-race completeness; later ingestion must validate the remaining drivers and laps.
