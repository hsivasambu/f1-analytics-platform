# Metric definitions — Stage 1

No metrics are implemented or presented as results. `product-questions.md` records intended comparisons. Before analytics implementation, define matched-lap eligibility, signed difference direction, summary statistic, stint boundaries, pit-duration meaning, change thresholds and exclusion rules. Record sample size, units, query/version and missing-data behavior for every computed output. Do not equate observed pace with driver ability or causal strategy effects.

## Stage 2 — profiling only

The CLI computes descriptive data-quality counts, not race pace metrics: row count; per observed field JSON types, absent properties, explicit nulls and numeric zeros; candidate-key missing/duplicate counts; lap-to-driver orphan count; number of inclusive stint ranges covering each sampled lap; race-control category/scope frequencies; invalid parsed timestamps; numeric lane/pit alias mismatches. Examples are the first three distinct non-null serialized values in source order.

Candidate-key duplicate count = number of rows with all key values present minus unique serialized tuples among those rows. Missing key count uses null or absent values. A lap with 0 or more than 1 matching stint range is a quality issue, not silently resolved. Profile counts cover the retrieved sample only. No matched pace, pit-loss, lap-change threshold or causal metric has been implemented.
