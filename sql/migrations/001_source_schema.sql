-- 001: normalized source fields plus immutable provenance.
CREATE SCHEMA f1;
CREATE SCHEMA f1_ingest;

CREATE TABLE f1_ingest.ingestion_runs (
  run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('openf1', 'fixture')),
  purpose text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed')),
  error_summary text,
  CHECK (finished_at IS NULL OR finished_at >= started_at)
);
CREATE TABLE f1_ingest.source_payloads (
  payload_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES f1_ingest.ingestion_runs,
  endpoint text NOT NULL CHECK (endpoint IN ('sessions','drivers','laps','stints','pit','race_control')),
  request_url text NOT NULL,
  query_parameters jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(query_parameters) = 'object'),
  retrieved_at timestamptz NOT NULL,
  raw_response text NOT NULL CHECK (jsonb_typeof(raw_response::jsonb) = 'array'),
  response_sha256 text NOT NULL,
  response_bytes integer NOT NULL CHECK (response_bytes >= 0),
  row_count integer NOT NULL CHECK (row_count >= 0),
  UNIQUE (run_id, endpoint, request_url, response_sha256)
);
CREATE FUNCTION f1_ingest.validate_payload() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog AS $$
BEGIN
  NEW.response_sha256 := encode(sha256(convert_to(NEW.raw_response, 'UTF8')), 'hex');
  NEW.response_bytes := octet_length(convert_to(NEW.raw_response, 'UTF8'));
  NEW.row_count := jsonb_array_length(NEW.raw_response::jsonb);
  RETURN NEW;
END $$;
CREATE TRIGGER payload_provenance BEFORE INSERT ON f1_ingest.source_payloads
FOR EACH ROW EXECUTE FUNCTION f1_ingest.validate_payload();

CREATE TABLE f1_ingest.source_records (
  record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload_id uuid NOT NULL REFERENCES f1_ingest.source_payloads,
  source_ordinal integer NOT NULL CHECK (source_ordinal >= 0),
  raw_record jsonb NOT NULL CHECK (jsonb_typeof(raw_record) = 'object'),
  content_sha256 text NOT NULL,
  occurrence_number integer NOT NULL CHECK (occurrence_number >= 1),
  UNIQUE (payload_id, source_ordinal)
);
CREATE FUNCTION f1_ingest.validate_record() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, f1_ingest AS $$
DECLARE body jsonb;
BEGIN
  SELECT raw_response::jsonb INTO STRICT body FROM f1_ingest.source_payloads WHERE payload_id = NEW.payload_id;
  IF body -> NEW.source_ordinal IS DISTINCT FROM NEW.raw_record THEN
    RAISE EXCEPTION 'raw record does not match payload ordinal' USING ERRCODE = '23514';
  END IF;
  NEW.content_sha256 := encode(sha256(convert_to(NEW.raw_record::text, 'UTF8')), 'hex');
  SELECT count(*) INTO NEW.occurrence_number FROM jsonb_array_elements(body) WITH ORDINALITY AS r(value, position)
    WHERE r.position <= NEW.source_ordinal + 1 AND r.value::text = NEW.raw_record::text;
  RETURN NEW;
END $$;
CREATE TRIGGER record_provenance BEFORE INSERT ON f1_ingest.source_records
FOR EACH ROW EXECUTE FUNCTION f1_ingest.validate_record();
CREATE FUNCTION f1_ingest.reject_archive_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'source archive is append-only' USING ERRCODE = '23514'; END $$;
CREATE TRIGGER immutable_payload BEFORE UPDATE OR DELETE ON f1_ingest.source_payloads
FOR EACH ROW EXECUTE FUNCTION f1_ingest.reject_archive_change();
CREATE TRIGGER immutable_record BEFORE UPDATE OR DELETE ON f1_ingest.source_records
FOR EACH ROW EXECUTE FUNCTION f1_ingest.reject_archive_change();

CREATE TABLE f1.sessions (
  session_key integer PRIMARY KEY CHECK (session_key > 0),
  meeting_key integer,
  year integer,
  session_name text,
  session_type text,
  circuit_key integer,
  circuit_short_name text,
  country_code text,
  country_key integer,
  country_name text,
  location text,
  date_start timestamptz,
  date_end timestamptz,
  gmt_offset text,
  is_cancelled boolean,
  source_record_id uuid NOT NULL REFERENCES f1_ingest.source_records
);
CREATE TABLE f1.drivers (
  driver_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text,
  identity_status text NOT NULL DEFAULT 'unresolved' CHECK (identity_status IN ('unresolved', 'verified')),
  source_record_id uuid NOT NULL REFERENCES f1_ingest.source_records
);
CREATE TABLE f1.session_entries (
  session_key integer NOT NULL REFERENCES f1.sessions,
  driver_number integer NOT NULL CHECK (driver_number > 0),
  driver_id uuid REFERENCES f1.drivers,
  broadcast_name text,
  first_name text,
  last_name text,
  full_name text,
  name_acronym text,
  team_name text,
  team_colour text,
  country_code text,
  headshot_url text,
  source_record_id uuid NOT NULL REFERENCES f1_ingest.source_records,
  PRIMARY KEY (session_key, driver_number)
);
CREATE TABLE f1.laps (
  session_key integer NOT NULL,
  driver_number integer NOT NULL,
  lap_number integer NOT NULL CHECK (lap_number >= 1),
  date_start timestamptz,
  lap_duration numeric CHECK (lap_duration >= 0 AND lap_duration < 'Infinity'::numeric),
  duration_sector_1 numeric CHECK (duration_sector_1 >= 0 AND duration_sector_1 < 'Infinity'::numeric),
  duration_sector_2 numeric CHECK (duration_sector_2 >= 0 AND duration_sector_2 < 'Infinity'::numeric),
  duration_sector_3 numeric CHECK (duration_sector_3 >= 0 AND duration_sector_3 < 'Infinity'::numeric),
  is_pit_out_lap boolean,
  i1_speed numeric CHECK (i1_speed >= 0 AND i1_speed < 'Infinity'::numeric),
  i2_speed numeric CHECK (i2_speed >= 0 AND i2_speed < 'Infinity'::numeric),
  st_speed numeric CHECK (st_speed >= 0 AND st_speed < 'Infinity'::numeric),
  segments_sector_1 jsonb CHECK (jsonb_typeof(segments_sector_1) = 'array'),
  segments_sector_2 jsonb CHECK (jsonb_typeof(segments_sector_2) = 'array'),
  segments_sector_3 jsonb CHECK (jsonb_typeof(segments_sector_3) = 'array'),
  source_record_id uuid NOT NULL REFERENCES f1_ingest.source_records,
  PRIMARY KEY (session_key, driver_number, lap_number),
  FOREIGN KEY (session_key, driver_number) REFERENCES f1.session_entries
);
CREATE TABLE f1.stints (
  session_key integer NOT NULL,
  driver_number integer NOT NULL,
  stint_number integer NOT NULL CHECK (stint_number >= 1),
  compound text,
  lap_start integer CHECK (lap_start >= 1),
  lap_end integer CHECK (lap_end >= 0),
  tyre_age_at_start integer CHECK (tyre_age_at_start >= 0),
  source_record_id uuid NOT NULL REFERENCES f1_ingest.source_records,
  PRIMARY KEY (session_key, driver_number, stint_number),
  FOREIGN KEY (session_key, driver_number) REFERENCES f1.session_entries
);
CREATE TABLE f1.pit_events (
  pit_event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_key integer NOT NULL REFERENCES f1.sessions,
  driver_number integer,
  date timestamptz,
  lap_number integer CHECK (lap_number >= 0),
  lane_duration numeric CHECK (lane_duration >= 0 AND lane_duration < 'Infinity'::numeric),
  pit_duration numeric CHECK (pit_duration >= 0 AND pit_duration < 'Infinity'::numeric),
  stop_duration numeric CHECK (stop_duration >= 0 AND stop_duration < 'Infinity'::numeric),
  source_record_id uuid NOT NULL REFERENCES f1_ingest.source_records,
  content_sha256 text NOT NULL,
  occurrence_number integer NOT NULL CHECK (occurrence_number >= 1),
  UNIQUE (session_key, content_sha256, occurrence_number),
  FOREIGN KEY (session_key, driver_number) REFERENCES f1.session_entries
);
CREATE TABLE f1.race_control_events (
  race_control_event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_key integer NOT NULL REFERENCES f1.sessions,
  driver_number integer,
  date timestamptz,
  lap_number integer CHECK (lap_number >= 0),
  category text,
  flag text,
  message text,
  scope text,
  sector integer CHECK (sector >= 1),
  qualifying_phase integer,
  source_record_id uuid NOT NULL REFERENCES f1_ingest.source_records,
  content_sha256 text NOT NULL,
  occurrence_number integer NOT NULL CHECK (occurrence_number >= 1),
  UNIQUE (session_key, content_sha256, occurrence_number),
  FOREIGN KEY (session_key, driver_number) REFERENCES f1.session_entries
);
-- Preserve every raw field in the fingerprint, including null/absent and future fields.
CREATE FUNCTION f1_ingest.attach_provenance() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, f1_ingest AS $$
DECLARE observed record;
BEGIN
  SELECT r.*, p.endpoint INTO STRICT observed FROM f1_ingest.source_records r
    JOIN f1_ingest.source_payloads p USING (payload_id) WHERE r.record_id = NEW.source_record_id;
  IF observed.endpoint <> TG_ARGV[0] THEN
    RAISE EXCEPTION 'wrong provenance endpoint' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME <> 'drivers' THEN
    IF observed.raw_record -> 'session_key' IS DISTINCT FROM to_jsonb(NEW.session_key) THEN
      RAISE EXCEPTION 'source session key mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_TABLE_NAME IN ('pit_events', 'race_control_events') THEN
    NEW.content_sha256 := observed.content_sha256;
    NEW.occurrence_number := observed.occurrence_number;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER session_provenance BEFORE INSERT OR UPDATE ON f1.sessions
FOR EACH ROW EXECUTE FUNCTION f1_ingest.attach_provenance('sessions');
CREATE TRIGGER driver_provenance BEFORE INSERT OR UPDATE ON f1.drivers
FOR EACH ROW EXECUTE FUNCTION f1_ingest.attach_provenance('drivers');
CREATE TRIGGER entry_provenance BEFORE INSERT OR UPDATE ON f1.session_entries
FOR EACH ROW EXECUTE FUNCTION f1_ingest.attach_provenance('drivers');
CREATE TRIGGER lap_provenance BEFORE INSERT OR UPDATE ON f1.laps
FOR EACH ROW EXECUTE FUNCTION f1_ingest.attach_provenance('laps');
CREATE TRIGGER stint_provenance BEFORE INSERT OR UPDATE ON f1.stints
FOR EACH ROW EXECUTE FUNCTION f1_ingest.attach_provenance('stints');
CREATE TRIGGER pit_provenance BEFORE INSERT OR UPDATE ON f1.pit_events
FOR EACH ROW EXECUTE FUNCTION f1_ingest.attach_provenance('pit');
CREATE TRIGGER control_provenance BEFORE INSERT OR UPDATE ON f1.race_control_events
FOR EACH ROW EXECUTE FUNCTION f1_ingest.attach_provenance('race_control');

-- Composite primary keys already index session/driver lookups; add alternate orderings.
CREATE INDEX laps_session_lap_idx ON f1.laps (session_key, lap_number, driver_number);
CREATE INDEX entries_driver_idx ON f1.session_entries (driver_id);
CREATE INDEX pit_session_date_idx ON f1.pit_events (session_key, date);
CREATE INDEX control_session_date_idx ON f1.race_control_events (session_key, date);
CREATE INDEX control_driver_idx ON f1.race_control_events (session_key, driver_number) WHERE driver_number IS NOT NULL;
CREATE INDEX pit_driver_idx ON f1.pit_events (session_key, driver_number) WHERE driver_number IS NOT NULL;
CREATE INDEX payload_run_idx ON f1_ingest.source_payloads (run_id);
CREATE INDEX record_content_idx ON f1_ingest.source_records (content_sha256, occurrence_number);
CREATE INDEX sessions_year_idx ON f1.sessions (year, date_start);
COMMENT ON COLUMN f1.laps.date_start IS 'Approximate source lap-start instant. Original timestamp string remains in raw archive.';
COMMENT ON COLUMN f1.pit_events.lane_duration IS 'Seconds in pit lane, not stationary service time.';
COMMENT ON COLUMN f1.pit_events.pit_duration IS 'Deprecated source alias; retained independently without enforcing equality.';
COMMENT ON COLUMN f1.pit_events.stop_duration IS 'Stationary seconds, nullable; source coverage documented from 2024 US GP.';
COMMENT ON TABLE f1.drivers IS 'Internal provisional identity. Never infer cross-session identity from driver number or name alone.';
