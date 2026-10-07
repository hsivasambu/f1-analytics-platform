# Exercises — predict before running

Use the actual race commands in the workbook README. For exact arithmetic predictions use this small **fictional fixture**, created only in the disposable local test database by `sql:verify`. Drivers 1 and 44 are A/B; driver 99 is a session entry with no lap records.

| Lap | A seconds | B seconds | Eligibility evidence |
|---|---:|---:|---|
| 1 | 100 | 110 | Both excluded as race-start laps |
| 2 | 90 | 91 | Both candidates |
| 3 | 92 | 95 | Both candidates |
| 4 | 120 | 93 | A pit-event lap; B candidate |
| 5 | 94 | 101 | A pit-out; B candidate |
| 6 | NULL | absent record | A duration missing; never zero |
| 7 | 96 | 99 | Both candidates |

A stint 1 covers inclusive laps 1–3 (HARD), stint 2 covers 4–7 (MEDIUM). B has one HARD stint 1–7. One A pit event at lap 4 has lane duration 20 and stationary duration NULL. Two race-control notices exist: one dated, one with missing timestamp. Neither notice establishes track state. Baseline intervals are sequential where consecutive recorded lap numbers exist; no artificial interruption is added. All laps retain green status not established.

## 1. Session row counts — SELECT, WHERE, COUNT

Predict total lap records, missing durations and candidates. Why would joining laps, pit events and stints before counting inflate counts? Run query 1. Find the subquery using `WHERE lap_duration IS NULL`; replace with `= NULL`, predict the count and restore it afterward. SELECT chooses output expressions; WHERE keeps rows satisfying a true condition. Unknown NULL comparisons are not true.

## 2. Driver lap coverage — LEFT JOIN, GROUP BY

Predict A/B/99 recorded counts, known durations, first/last laps and interior missing lap numbers. Why use `count(o.lap_number)` instead of `count(*)` after the LEFT JOIN? GROUP BY creates one summary per driver; LEFT JOIN retains entries with no matching laps. Add `WHERE o.pace_candidate` before GROUP BY and predict which entries disappear and how recorded counts change. Keep session AND driver keys in joins: driver number alone is not a global identity.

## 3. Fastest eligible lap — MIN and tied joins

Predict the fastest candidate and sample count for A/B. Will 99 appear? The `eligible` CTE names a filtered result, `best` groups its minimum, then a JOIN returns every tied lap. Change A lap 7 to 90 in the local fixture source, predict ties and restore it. The verifier already checks this variation automatically after baseline assertions.

## 4. Median eligible lap time — ordered percentiles and NULLs

Predict A/B median and driver 99's result. Then restrict the range to laps 1–3: what is A's median? `percentile_cont(0.5) WITHIN GROUP` orders values and can interpolate between adjacent values. Compare it with `percentile_disc(0.5)` after predicting the difference. Do not COALESCE unavailable durations or empty medians to zero.

## 5. Matched-lap driver comparison — CTEs and self JOIN

List shared eligible lap numbers before calculating A−B. Predict sample count, mean and median difference. Compare with A's overall eligible mean minus B's overall eligible mean: why are they different samples? Run query 5 on the real race, change `--from-lap`/`--to-lap`, and explain which pairs remain. Swap A/B and predict the sign. Removing lap-number equality creates an invalid many-to-many comparison; predict its fixture row count before trying it locally.

## 6. Stint summaries — inclusive range JOIN

Predict samples and medians for A's two stints and B's stint. Which stints include boundary lap 3/4? Why does a sample mean not prove a tyre compound caused a change? Query 6 joins on session, driver and inclusive lap bounds, and requires stint candidacy. Change BETWEEN to strict `>`/`<` bounds in the answer, predict lost boundary laps, run and restore.

## 7. LAG-based lap changes — window ordering and CASE

Predict A lap 3's change, A lap 7's change, and B lap 7's change. LAG returns the previous observed row within a driver/session partition; it does not guarantee the previous lap number exists or is eligible. CASE returns a difference only when those checks pass. What happens if you filter to eligible laps before applying LAG and omit the consecutive-lap check? Why does filtering displayed results to lap 3 still retain lap 2 history?

## 8. Rolling pace — RANGE versus ROWS frames

Predict B lap 5's complete rolling mean, and B lap 7's observed/eligible counts, available mean and complete mean. Change `RANGE BETWEEN 2 PRECEDING` to `ROWS BETWEEN 2 PRECEDING`. Predict B lap 7's new result, run query 8 and restore. RANGE measures lap-number distance; ROWS counts surviving rows. A partial mean is labelled, never presented as three complete laps. The selected display range is applied after computing history.

## 9. Pit/race-control timeline — UNION ALL and ordering

Predict event count and which record sorts last. Would UNION risk losing repeated observations? Keep event types, source IDs, independent duration fields and NULLs. Pit-lane duration is not stationary service time or causal time lost. Race-control timestamp is announcement time, not necessarily the affected lap; source_lap_number is a recorded label. Narrowing displayed lap bounds does not silently discard session timeline events.

## 10. Exclusion sensitivity — arrays, NOT EXISTS and paired samples

Predict shared lap numbers and mean A−B under strict and `allow_known_pit_laps`. Can the sign reverse? The relaxed mode removes only known pit-event/pit-out reasons; missing durations, unknown pit status, start laps, interruption and boundary reasons still block candidacy. NOT EXISTS tests that no unignored exclusion remains. What happens if you ignore only `pit_event_lap`, leaving other reasons intact? Explain why sensitivity changes describe selection policy, not what would have happened under another strategy.

After your predictions, run `npm run sql:verify -- --show` and open [answers](answers.md). For a personal checkpoint, complete exercises 5 and 8, recording the filter/window you changed, before/after sample counts and why the difference occurred.
