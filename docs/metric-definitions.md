# Metric definitions — Stage 1

No metrics are implemented or presented as results. `product-questions.md` records intended comparisons. Before analytics implementation, define matched-lap eligibility, signed difference direction, summary statistic, stint boundaries, pit-duration meaning, change thresholds and exclusion rules. Record sample size, units, query/version and missing-data behavior for every computed output. Do not equate observed pace with driver ability or causal strategy effects.

## Stage 2 — profiling only

The CLI computes descriptive data-quality counts, not race pace metrics: row count; per observed field JSON types, absent properties, explicit nulls and numeric zeros; candidate-key missing/duplicate counts; lap-to-driver orphan count; number of inclusive stint ranges covering each sampled lap; race-control category/scope frequencies; invalid parsed timestamps; numeric lane/pit alias mismatches. Examples are the first three distinct non-null serialized values in source order.

Candidate-key duplicate count = number of rows with all key values present minus unique serialized tuples among those rows. Missing key count uses null or absent values. A lap with 0 or more than 1 matching stint range is a quality issue, not silently resolved. Profile counts cover the retrieved sample only. No matched pace, pit-loss, lap-change threshold or causal metric has been implemented.

## Stage 5 implemented eligibility counts

Lap count counts source occurrences; pace candidates have no exclusion and no dataset hard failure; excluded count is the complement once per lap. Reason frequencies overlap. Stint candidates also require exactly one inclusive stint assignment and non-null compound. Warning findings count diagnostic entries, not unique laps. Unknown durations stay NULL; nonpositive/nonfinite durations are hard failures. No averages or matched-driver pace metrics are implemented.

quality-v1 excludes missing/invalid durations, race-start laps, pit-out/unknown pit-out status, pit source-lap/time overlap, unknown/inconsistent intervals, explicit deleted-time notices, neutralized overlap, possible neutralization boundary overlap and yellow warnings. Hard failures block all candidates. Blue flags and coverage gaps warn; ambiguous stints block only stint candidacy. Half-open intervals use a manual 1,000 ms review buffer. Green status remains not established. See stage-5-quality.md for commands, definitions and exercises.

## Stage 6 implemented workbook calculations

These are terminal learning queries, not dashboard metrics. All duration results use seconds and current source/policy versions. Counts use observed records; COUNT(duration) counts only known durations. Eligible fastest returns every tied minimum. Median uses percentile_cont(0.5), ignoring unknown inputs and interpolating where necessary; sample counts accompany it. Empty samples return NULL for measurements, never zero.

Matched pace joins the same session/lap numbers eligible for both selected drivers within the inclusive lap filter. Signed difference is A duration minus B duration; mean/median are computed from exactly those paired differences. Negative means fewer recorded seconds for A on that sample. Display individual eligible counts, paired count and exact lap numbers. Same lap number does not imply simultaneous conditions. No driver-skill, causal tyre-degradation or strategy-counterfactual claim follows.

Stint summaries use inclusive source boundaries and stint_candidate, with eligible count, observed span, mean and median. LAG changes are current minus preceding duration only when both adjacent lap numbers are eligible; gaps/excluded predecessors yield NULL. History is computed before the displayed range filter. Rolling RANGE covers the current lap number and previous two numbers; count observed/eligible observations and label available mean. Complete three-lap mean requires all three eligible consecutive numbers, otherwise NULL. Windows partition by session/driver. No significant-change threshold is defined.

Timeline UNION ALL preserves typed event occurrences and independently labels lane, deprecated pit alias and stationary duration; NULL remains unknown. Sensitivity recomputes matched samples with only known pit reasons ignored; start/unknown-duration/unknown-pit-status/neutralization/boundary/deleted-time exclusions remain. Modes describe exclusion selection, not strategy effects. See sql/workbook for SQL, exercises, expected fictional calculations and actual versioned output examples.
