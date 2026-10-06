-- Deliberately synthetic data, not OpenF1 measurements. CLI wraps this in BEGIN/ROLLBACK.
-- Large synthetic session keys distinguish fixture rows; never ingest them as real races.
CREATE TEMP TABLE fixture_records (endpoint text, ordinal integer, record_id uuid, raw jsonb);
DO $$
DECLARE run uuid; payload uuid; item record; ordinal integer; rows jsonb; rec uuid;
BEGIN
  INSERT INTO f1_ingest.ingestion_runs (source, purpose, status, finished_at)
    VALUES ('fixture', 'Stage 3 synthetic transactional fixture', 'succeeded', now()) RETURNING run_id INTO run;
  FOR item IN SELECT * FROM (VALUES
    ('sessions', '[{"session_key":900000001,"year":2024,"session_name":"FIXTURE A","date_start":"2024-01-01T12:00:00+00:00"},{"session_key":900000002,"year":2025,"session_name":"FIXTURE B"}]'::jsonb),
    ('drivers', '[{"session_key":900000001,"driver_number":1,"full_name":"Fixture Driver A"},{"session_key":900000002,"driver_number":1,"full_name":"Different Fixture Driver"}]'::jsonb),
    ('laps', '[{"session_key":900000001,"driver_number":1,"lap_number":1,"lap_duration":90.125,"date_start":"2024-01-01T13:00:00+01:00"},{"session_key":900000001,"driver_number":1,"lap_number":2,"lap_duration":null},{"session_key":900000002,"driver_number":1,"lap_number":1,"lap_duration":91.5}]'::jsonb),
    ('stints', '[{"session_key":900000001,"driver_number":1,"stint_number":1,"lap_start":1,"lap_end":2,"compound":"FIXTURE","tyre_age_at_start":0}]'::jsonb),
    ('pit', '[{"session_key":900000001,"driver_number":1,"date":"2024-01-01T12:02:00+00:00","lap_number":1,"lane_duration":20,"pit_duration":20,"stop_duration":null},{"session_key":900000001,"driver_number":1,"date":"2024-01-01T12:02:00+00:00","lap_number":1,"lane_duration":22,"pit_duration":22,"stop_duration":2},{"session_key":900000001,"driver_number":1,"date":"2024-01-01T12:02:00+00:00","lap_number":1,"lane_duration":20,"pit_duration":20,"stop_duration":null}]'::jsonb),
    ('race_control', '[{"session_key":900000001,"date":"2024-01-01T11:00:00+00:00","category":"Flag","message":"FIXTURE ONLY","scope":"Driver","driver_number":1},{"session_key":900000001,"date":"2024-01-01T11:00:00+00:00","category":"Flag","message":"FIXTURE ONLY","scope":"Track","driver_number":null}]'::jsonb)
  ) AS packets(endpoint, body)
  LOOP
    rows := item.body;
    INSERT INTO f1_ingest.source_payloads (run_id, endpoint, request_url, retrieved_at, raw_response)
      VALUES (run, item.endpoint, 'fixture://stage3/' || item.endpoint, now(), rows::text) RETURNING payload_id INTO payload;
    FOR ordinal IN 0 .. jsonb_array_length(rows) - 1 LOOP
      INSERT INTO f1_ingest.source_records (payload_id, source_ordinal, raw_record)
        VALUES (payload, ordinal, rows -> ordinal) RETURNING record_id INTO rec;
      INSERT INTO fixture_records VALUES (item.endpoint, ordinal, rec, rows -> ordinal);
    END LOOP;
  END LOOP;
END $$;
INSERT INTO f1.sessions (session_key, year, session_name, date_start, source_record_id)
SELECT (raw->>'session_key')::integer, (raw->>'year')::integer, raw->>'session_name',
  (raw->>'date_start')::timestamptz, record_id FROM fixture_records WHERE endpoint = 'sessions';
INSERT INTO f1.drivers (driver_id, display_name, source_record_id)
SELECT record_id, raw->>'full_name', record_id FROM fixture_records WHERE endpoint = 'drivers';
INSERT INTO f1.session_entries (session_key, driver_number, driver_id, full_name, source_record_id)
SELECT (raw->>'session_key')::integer, (raw->>'driver_number')::integer, record_id, raw->>'full_name', record_id
FROM fixture_records WHERE endpoint = 'drivers';
INSERT INTO f1.laps (session_key, driver_number, lap_number, lap_duration, date_start, source_record_id)
SELECT (raw->>'session_key')::integer, (raw->>'driver_number')::integer, (raw->>'lap_number')::integer,
  (raw->>'lap_duration')::numeric, (raw->>'date_start')::timestamptz, record_id FROM fixture_records WHERE endpoint = 'laps';
INSERT INTO f1.stints (session_key, driver_number, stint_number, lap_start, lap_end, compound, tyre_age_at_start, source_record_id)
SELECT (raw->>'session_key')::integer, (raw->>'driver_number')::integer, (raw->>'stint_number')::integer,
  (raw->>'lap_start')::integer, (raw->>'lap_end')::integer, raw->>'compound', (raw->>'tyre_age_at_start')::integer, record_id
FROM fixture_records WHERE endpoint = 'stints';
INSERT INTO f1.pit_events (session_key, driver_number, date, lap_number, lane_duration, pit_duration, stop_duration, source_record_id)
SELECT (raw->>'session_key')::integer, (raw->>'driver_number')::integer, (raw->>'date')::timestamptz,
  (raw->>'lap_number')::integer, (raw->>'lane_duration')::numeric, (raw->>'pit_duration')::numeric,
  (raw->>'stop_duration')::numeric, record_id FROM fixture_records WHERE endpoint = 'pit';
INSERT INTO f1.race_control_events (session_key, driver_number, date, category, message, scope, source_record_id)
SELECT (raw->>'session_key')::integer, (raw->>'driver_number')::integer, (raw->>'date')::timestamptz,
  raw->>'category', raw->>'message', raw->>'scope', record_id FROM fixture_records WHERE endpoint = 'race_control';
