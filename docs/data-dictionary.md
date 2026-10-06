# Data dictionary — Stage 1

No race dataset or database schema exists. Proposed table names and source mappings are in `product-questions.md`; they are not a finalized schema. No fake race data is displayed. A later schema stage must document keys, units, null meanings, raw source fields, source mappings and provenance before ingestion.

## Stage 2 — observed OpenF1 records

No Postgres schema exists. The real investigation sample is described field by field (types, absent/null/zero counts and example values) in [openf1-profile.md](openf1-profile.md). These are observed JSON types, not SQL column declarations or guaranteed source schema contracts.

| Endpoint | Record grain / candidate key | Meaning and join candidates |
| --- | --- | --- |
| sessions | One track session; session_key | meeting_key groups weekend sessions. session_name=Race selects the main race. UTC date_start/date_end metadata does not itself prove final classification. |
| drivers | One driver in a session; session_key + driver_number | driver_number is numeric, not a permanent cross-season person ID. Join laps/stints/pit on both fields. |
| laps | One numbered lap for a driver in a session; session_key + driver_number + lap_number | lap_duration and duration_sector_* are seconds; date_start is approximate UTC. Boolean is_pit_out_lap is preserved. Null speeds/sectors are not zero. Arrays are retained without race mini-sector interpretation. |
| stints | One driver stint in a session; session_key + driver_number + stint_number | Inclusive lap_start/lap_end are a candidate range join, checked for matches in the sample. compound is source text; tyre_age_at_start counts prior completed laps and can be 0. |
| pit | One recorded pit-lane visit; session_key + driver_number + date candidate | lap_number associates the event to a lap. lane_duration is seconds in the pit lane; deprecated pit_duration is an alias. stop_duration is stationary seconds, may be null, and is documented only from 2024 US GP onward. No source event ID is provided here. |
| race_control | One message/event record; source provides no explicit message ID | date is UTC; category/scope/message describe the record. Driver, flag, sector, qualifying_phase and scope may be null. session_key + date + category + message is only a sampled candidate key; preserve all fields before choosing a durable deduplication rule. |

The sampled keys have no missing values or duplicates. That does not guarantee uniqueness across other races. Race-control timestamps can repeat; nullable scopes/drivers prevent unconditional driver joins. Actual control messages can precede session start. Pit events and stint changes must be reconciled rather than treated as equivalent.

Provenance manifest: filename, endpoint, query filters, exact URL, retrievedAt UTC, SHA-256 of original UTF-8 response text, bytes, rows, attempts. Fields completely absent from all rows will not appear in the union-of-observed-fields profile; compare the official docs to detect those. Absent means property not present; null means property present with JSON null; zero means a numeric source value. Nested array element nulls are outside top-level null counts.
