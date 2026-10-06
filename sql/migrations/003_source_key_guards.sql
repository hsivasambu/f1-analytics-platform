-- 003: enforce source natural keys, beyond merely checking the endpoint/session.
CREATE OR REPLACE FUNCTION f1_ingest.attach_provenance() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, f1_ingest AS $$
DECLARE observed record;
BEGIN
  SELECT r.*, p.endpoint INTO STRICT observed FROM f1_ingest.source_records r
    JOIN f1_ingest.source_payloads p USING (payload_id) WHERE r.record_id = NEW.source_record_id;
  IF observed.endpoint <> TG_ARGV[0] THEN
    RAISE EXCEPTION 'wrong provenance endpoint' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME <> 'drivers' THEN
    IF (observed.raw_record ->> 'session_key')::integer IS DISTINCT FROM NEW.session_key THEN
      RAISE EXCEPTION 'source session key mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_TABLE_NAME IN ('session_entries','laps','stints','pit_events','race_control_events') THEN
    IF (observed.raw_record ->> 'driver_number')::integer IS DISTINCT FROM NEW.driver_number THEN
      RAISE EXCEPTION 'source driver number mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_TABLE_NAME IN ('laps','pit_events','race_control_events') THEN
    IF (observed.raw_record ->> 'lap_number')::integer IS DISTINCT FROM NEW.lap_number THEN
      RAISE EXCEPTION 'source lap number mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_TABLE_NAME = 'stints' THEN
    IF (observed.raw_record ->> 'stint_number')::integer IS DISTINCT FROM NEW.stint_number THEN
      RAISE EXCEPTION 'source stint number mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_TABLE_NAME IN ('pit_events','race_control_events') THEN
    NEW.content_sha256 := observed.content_sha256;
    NEW.occurrence_number := observed.occurrence_number;
  END IF;
  RETURN NEW;
END $$;
