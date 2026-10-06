# Data dictionary — implemented Stage 3 schema

Migrations are in `sql/migrations`. `f1` holds typed source projections, `f1_ingest` holds raw provenance, and `f1_meta` holds migration history. No real race data is loaded into Postgres yet. The Stage 2 local archive and [observed profile](openf1-profile.md) remain the empirical basis. Fixtures are explicitly synthetic and roll back.

## Grain, primary keys and relationships

| Table | One row represents | Primary key | Relationships / uniqueness |
| --- | --- | --- | --- |
| f1.sessions | One OpenF1 session | session_key integer | source_record_id → source_records. OpenF1 namespace only; meeting_key groups weekend sessions without a meeting table. |
| f1.drivers | One internally assigned, provisional driver identity | driver_id UUID | source_record_id → a drivers source record. No unique number/name/acronym rule. This is not an automatic claim that two entries are the same person. |
| f1.session_entries | One numbered driver entry in one session | (session_key, driver_number) | session_key → sessions; optional driver_id → drivers; source_record_id → drivers source record. Team/name/number observations belong here. |
| f1.laps | One numbered lap of one session entry | (session_key, driver_number, lap_number) | (session_key, driver_number) → session_entries; source_record_id → laps source record. |
| f1.stints | One numbered stint of one session entry | (session_key, driver_number, stint_number) | (session_key, driver_number) → session_entries; source_record_id → stints source record. Lap-range join is checked in queries, not a lap FK. |
| f1.pit_events | One preserved pit-event content/occurrence | pit_event_id bigint identity | session_key → sessions; optional (session_key, driver_number) → entry; source_record_id → pit source record. UNIQUE(session_key, content_sha256, occurrence_number). |
| f1.race_control_events | One preserved control-event content/occurrence | race_control_event_id bigint identity | Same session/optional entry/source relationships. UNIQUE(session_key, content_sha256, occurrence_number). Timestamp alone is not unique. |
| f1_ingest.ingestion_runs | One source-processing attempt | run_id UUID | Owns payloads; records source, purpose, status and attempt times. No ingestion pipeline is implemented yet. |
| f1_ingest.source_payloads | One HTTP-response observation in a run | payload_id UUID | run_id → ingestion_runs; UNIQUE(run_id, endpoint, request_url, response_sha256). Separate reruns retain separate provenance. |
| f1_ingest.source_records | One array element in a source response | record_id UUID | payload_id → source_payloads; UNIQUE(payload_id, source_ordinal). Zero-based ordinal retains duplicate occurrences. |
| f1_meta.schema_migrations | One applied migration file | version text (filename) | SHA-256 and applied_at prevent silent edits and reruns. Only migration credentials access this schema. |

A primary key identifies a row and creates a unique index. A foreign key requires its parent row to exist; it does not automatically fetch it. An entry numbered 1 in 2024 does not identify the person behind an entry numbered 1 in 2025. UUID identity assignments may remain unresolved, and driver_id on an entry may be null. Cross-session person matching is not implemented.

## Fields and SQL types

Except keys, provenance pointers, event fingerprints/occurrences and administrative fields explicitly listed as required, source fields are nullable. NULL in the projection means unknown; raw JSON distinguishes an absent property from an explicit JSON null. No source field receives an invented zero/false/empty-string default.

| Table | Fields | Type / meaning |
| --- | --- | --- |
| sessions | session_key | integer, required, >0; source key |
| sessions | meeting_key, year, circuit_key, country_key | nullable integer source metadata |
| sessions | session_name, session_type, circuit_short_name, country_code, country_name, location, gmt_offset | nullable text; preserve spelling/case and offset text |
| sessions | date_start, date_end | nullable timestamptz; source instants, not enforced event bounds |
| sessions | is_cancelled | nullable boolean; unknown is not false |
| drivers | driver_id, display_name, identity_status | UUID default gen_random_uuid; nullable internal display text; required status unresolved/verified, default unresolved |
| session_entries | session_key, driver_number, driver_id | required integer composite key (driver_number >0); nullable UUID identity FK |
| session_entries | broadcast_name, first_name, last_name, full_name, name_acronym, team_name, team_colour, country_code, headshot_url | nullable source text; no assumed hex/name/acronym uniqueness or enum |
| laps | session_key, driver_number, lap_number | integer composite key; lap_number ≥1 |
| laps | date_start, is_pit_out_lap | nullable timestamptz (approximate source start); nullable boolean |
| laps | lap_duration, duration_sector_1/2/3 | nullable numeric seconds; no fixed precision/scale, so values are not rounded at storage |
| laps | i1_speed, i2_speed, st_speed | nullable numeric km/h; source numeric values retained |
| laps | segments_sector_1/2/3 | nullable jsonb arrays with element nulls intact; no race mini-sector interpretation |
| stints | session_key, driver_number, stint_number | integer composite key; stint_number ≥1 |
| stints | compound | nullable text; no closed compound enum |
| stints | lap_start, lap_end, tyre_age_at_start | nullable integer; start ≥1, end ≥0, tyre age ≥0. Numeric 0 tyre age is known, not missing |
| pit_events | pit_event_id, session_key, driver_number | generated bigint PK; required session integer; nullable driver integer |
| pit_events | date, lap_number | nullable timestamptz; nullable integer ≥0 |
| pit_events | lane_duration, pit_duration, stop_duration | nullable numeric seconds; lane time, retained deprecated alias and stationary time respectively |
| race_control_events | race_control_event_id, session_key, driver_number | generated bigint PK; required session integer; nullable driver integer |
| race_control_events | date, lap_number, sector, qualifying_phase | nullable timestamptz, integer ≥0, integer ≥1, integer without closed phase enum |
| race_control_events | category, flag, message, scope | nullable text; future source categories preserved, not rejected by an enum |
| both event tables | content_sha256, occurrence_number | required text/integer; filled from source record by trigger. Not supplied by the caller |
| all typed tables | source_record_id | required UUID FK into source_records; trigger checks endpoint; source natural keys are checked where present |
| ingestion_runs | run_id, source, purpose, started_at, finished_at, status, error_summary | UUID; required source openf1/fixture and purpose; required timestamptz default now; nullable finish; required running/succeeded/failed status; nullable redacted error text |
| source_payloads | payload_id, run_id, endpoint, request_url, query_parameters, retrieved_at | required UUID/UUID/text/text/jsonb object/timestamptz. Endpoint limited to the six investigated endpoints; query_parameters defaults to an administrative empty object |
| source_payloads | raw_response, response_sha256, response_bytes, row_count | original required JSON array text; DB-derived SHA-256, UTF-8 bytes and row count, all required |
| source_records | record_id, payload_id, source_ordinal, raw_record | UUID/UUID/integer ≥0/jsonb object, all required; ordinal checked against the original response array |
| source_records | content_sha256, occurrence_number | required DB-derived hash of JSONB text and positive duplicate occurrence rank in that response |
| schema_migrations | version, sha256, applied_at | required text/text/timestamptz default now |

Postgres `numeric` is exact decimal; the Node pg client returns it as a string to avoid accidental binary floating-point loss. `timestamptz` stores the instant, not the original textual timezone. The original timestamp representation remains in the immutable raw_response and raw_record. SQL session timezone affects how an instant is displayed.

Durations and speeds permit numeric 0, reject negative and nonfinite values, and keep unknown values NULL. No sector-sum equality, duration maximum, stop-versus-lane inequality, pit alias equality or session-bound constraint is asserted. Stint range overlap/gaps and end-before-start are profiling issues; there is no hard ordering constraint. Race-control messages may precede scheduled session start. Pit/control events do not FK to laps: partial source coverage can supply an event before its lap is available.

## Deduplication without pretending there is a source event ID

1. Archive the full response text, request and retrieval time.
2. Create source_records per zero-based array position. The trigger verifies each object matches that array element.
3. Hash the complete `raw_record::text` representation with SHA-256. JSONB canonicalizes object key order/whitespace; numeric representations may retain scale. All fields, including unfamiliar fields, explicit nulls and absence, participate.
4. Count equal JSONB-text objects up to that position to derive occurrence_number = 1, 2, … . Identical objects twice in a response remain two events.
5. Use `(session_key, content_sha256, occurrence_number)` as a conservative event-content dedup key. Repeated full responses cannot create an extra canonical event with the same key. A same-time record with different scope/driver/duration/other content is distinct.

This is content/occurrence identity, not proof of real-world incident identity. A corrected record changes its fingerprint and remains separate; do not silently collapse it into its predecessor. Reconciliation/version-selection belongs to a later ingestion design. Identical events across differently incomplete/paginated responses can be ambiguous; a future loader must require a complete bounded event response or flag the ambiguity. Hash collisions must be checked by comparing retained content before any future ON CONFLICT handling; no such loader exists in Stage 3. All response observations remain archived even when a canonical event key is rejected.

Raw tables reject UPDATE/DELETE through triggers, including owner attempts; the ingestion login also lacks those grants. The archive stores exact response text and structural JSON; typed projections and provisional identities can be changed by controlled writer/migration roles. Non-key field mapping consistency is a later ingestion validation responsibility; source keys and endpoint links are enforced now.

## Indexes

Primary keys already support session/driver prefix searches and parent joins. `laps_session_lap_idx(session_key,lap_number,driver_number)` supports a different access path: drivers on one matched lap. Session/date indexes support event timelines; partial session/driver event indexes support driver-event lookup. Entries have a driver UUID index; payloads have a run index; source_records have a content/occurrence index; sessions have year/date indexing. Unique event indexes enforce deduplication. Indexes improve eligible lookups but add write/storage cost; Postgres may prefer a sequential scan for a tiny fixture. No performance claim has been measured yet.

## Stage 4 additions and lifecycle changes

- `f1_ingest.ingestion_runs`: nullable `session_key integer`, `data_version text` (SHA-256 version for a successful publication/check), `pipeline_version text` (stage4-v1), `endpoint_summary jsonb` (URL, retrieval timestamp, bytes, count, checksum per received endpoint), `changes jsonb` (previous/current counts, byte-identical flag, added/removed raw-object counts). Existing status/start/finish/error columns remain. Failed or interrupted attempts may lack complete summaries/version.
- `f1_ingest.staged_payloads`: grain one endpoint response per attempt; PK `(run_id,endpoint)`, run FK. `request_url text`, `retrieved_at timestamptz`, `raw_response text`. Six fixed endpoint names, nonempty JSON arrays, max 2 MB/2,000 rows per response. Private transactional staging; no rows retained after publication/rollback.
- `f1.session_datasets`: grain one currently published session; PK/FK `session_key`, origin `run_id uuid` FK, `data_version text`, `published_at timestamptz`, `endpoint_counts jsonb`. Unchanged bytes retain origin/time/version, while new successful attempt metadata records the later retrieval. Reader can SELECT this table; ingestion publication modifies it only through its restricted function.
- Archive UPDATE remains forbidden. Migration-owner deletion is now permitted for controlled retention through SECURITY DEFINER publication; ingestion/app have no general archive DELETE permission. Latest successful payloads/records survive; superseded versions are pruned. Compact history retains 20 summaries plus a protected origin if older. Existing stage-3 archive/identity rules otherwise hold.
- A changed response replaces the entire session projections, removes absent source rows and can regenerate pit/control surrogate IDs. Whole-object multiset additions/removals record corrections as removal plus addition. No new UUID drivers are inferred/created; existing linked entries block this initial refresh policy.
