-- 004: bounded staging and atomic, allowlisted session publication.
ALTER TABLE f1_ingest.ingestion_runs ADD COLUMN session_key integer;
ALTER TABLE f1_ingest.ingestion_runs ADD COLUMN data_version text;
ALTER TABLE f1_ingest.ingestion_runs ADD COLUMN endpoint_summary jsonb;
ALTER TABLE f1_ingest.ingestion_runs ADD COLUMN changes jsonb;
CREATE TABLE f1_ingest.staged_payloads (
 run_id uuid REFERENCES f1_ingest.ingestion_runs, endpoint text,
 request_url text NOT NULL, retrieved_at timestamptz NOT NULL,
 raw_response text NOT NULL CHECK (octet_length(raw_response) <= 2000000),
 PRIMARY KEY(run_id, endpoint),
 CHECK(endpoint IN ('sessions','drivers','laps','stints','pit','race_control')),
 CHECK(jsonb_typeof(raw_response::jsonb) = 'array'),
 CHECK(jsonb_array_length(raw_response::jsonb) BETWEEN 1 AND 2000)
);
CREATE TABLE f1.session_datasets (
 session_key integer PRIMARY KEY REFERENCES f1.sessions,
 run_id uuid NOT NULL REFERENCES f1_ingest.ingestion_runs,
 data_version text NOT NULL, published_at timestamptz NOT NULL DEFAULT now(),
 endpoint_counts jsonb NOT NULL
);
GRANT SELECT, INSERT ON f1_ingest.staged_payloads TO f1_ingestor;
GRANT SELECT ON f1.session_datasets TO f1_app_reader, f1_ingestor;
REVOKE INSERT, UPDATE ON f1.session_datasets FROM f1_ingestor;
-- Only the migration owner (including a SECURITY DEFINER publish call) may
-- delete immutable archive rows. UPDATE stays forbidden for everyone.
CREATE OR REPLACE FUNCTION f1_ingest.reject_archive_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' AND current_user = (SELECT pg_get_userbyid(proowner)
   FROM pg_proc WHERE oid = 'f1_ingest.publish(uuid)'::regprocedure) THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'source archive is append-only outside controlled retention' USING ERRCODE='23514';
END $$;
CREATE FUNCTION f1_ingest.publish(target_run uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog, f1_ingest AS $$
DECLARE target integer; packet record; previous jsonb; current_counts jsonb; version text; differences jsonb;
BEGIN
 SELECT session_key INTO STRICT target FROM f1_ingest.ingestion_runs
 WHERE run_id=target_run AND status='running';
 IF target <> 9644 THEN RAISE EXCEPTION 'Stage 4 permits only investigated session 9644'; END IF;
 PERFORM pg_advisory_xact_lock(713004, target);
 IF (SELECT count(*) FROM f1_ingest.staged_payloads WHERE run_id=target_run) <> 6
 THEN RAISE EXCEPTION 'all six endpoint packets required'; END IF;
 IF EXISTS (SELECT 1 FROM f1.session_entries WHERE session_key=target AND driver_id IS NOT NULL)
 THEN RAISE EXCEPTION 'linked identities require reviewed refresh mapping'; END IF;
 SELECT jsonb_object_agg(endpoint, jsonb_array_length(raw_response::jsonb)),
 encode(sha256(convert_to(string_agg('stage4-v1:' || endpoint || ':' || encode(sha256(convert_to(raw_response,'UTF8')),'hex'), '|' ORDER BY endpoint),'UTF8')),'hex')
 INTO current_counts, version FROM f1_ingest.staged_payloads WHERE run_id=target_run;
 SELECT endpoint_counts INTO previous FROM f1.session_datasets WHERE session_key=target;
 SELECT jsonb_object_agg(endpoint, jsonb_build_object('removed_objects',removed,'added_objects',added)) INTO differences
 FROM (SELECT s.endpoint,
 (SELECT count(*) FROM (SELECT r.raw_record FROM f1_ingest.source_records r
 JOIN f1_ingest.source_payloads p USING(payload_id) JOIN f1.session_datasets d ON d.run_id=p.run_id
 WHERE d.session_key=target AND p.endpoint=s.endpoint
 EXCEPT ALL SELECT value FROM jsonb_array_elements(s.raw_response::jsonb)) gone) AS removed,
 (SELECT count(*) FROM (SELECT value FROM jsonb_array_elements(s.raw_response::jsonb)
 EXCEPT ALL SELECT r.raw_record FROM f1_ingest.source_records r
 JOIN f1_ingest.source_payloads p USING(payload_id) JOIN f1.session_datasets d ON d.run_id=p.run_id
 WHERE d.session_key=target AND p.endpoint=s.endpoint) new_objects) AS added
 FROM f1_ingest.staged_payloads s WHERE run_id=target_run) diff;
 UPDATE f1_ingest.ingestion_runs SET data_version=version WHERE run_id=target_run;
 -- Byte-identical responses: retain original raw/typed rows and data version.
 IF NOT EXISTS (SELECT 1 FROM f1.session_datasets WHERE session_key=target AND data_version=version) THEN
  FOR packet IN SELECT * FROM f1_ingest.staged_payloads WHERE run_id=target_run LOOP
   INSERT INTO f1_ingest.source_payloads(run_id,endpoint,request_url,query_parameters,retrieved_at,raw_response,response_sha256,response_bytes,row_count)
   VALUES(target_run,packet.endpoint,packet.request_url,jsonb_build_object('session_key',target),packet.retrieved_at,packet.raw_response,'',0,0);
  END LOOP;
  INSERT INTO f1_ingest.source_records(payload_id,source_ordinal,raw_record,content_sha256,occurrence_number)
  SELECT p.payload_id, (e.ordinality-1)::integer, e.value, '', 1
  FROM f1_ingest.source_payloads p CROSS JOIN LATERAL jsonb_array_elements(p.raw_response::jsonb) WITH ORDINALITY e
  WHERE p.run_id=target_run;
  -- Children first. Missing rows in this complete endpoint refresh are removed.
  DELETE FROM f1.laps WHERE session_key=target;
  DELETE FROM f1.stints WHERE session_key=target;
  DELETE FROM f1.pit_events WHERE session_key=target;
  DELETE FROM f1.race_control_events WHERE session_key=target;
  DELETE FROM f1.session_entries WHERE session_key=target;
  INSERT INTO f1.sessions(session_key,meeting_key,year,session_name,session_type,circuit_key,circuit_short_name,country_code,country_key,country_name,location,date_start,date_end,gmt_offset,is_cancelled,source_record_id)
  SELECT x.session_key,x.meeting_key,x.year,x.session_name,x.session_type,x.circuit_key,x.circuit_short_name,x.country_code,x.country_key,x.country_name,x.location,x.date_start,x.date_end,x.gmt_offset,x.is_cancelled,x.source_record_id FROM f1_ingest.source_records r JOIN f1_ingest.source_payloads p USING(payload_id)
  CROSS JOIN LATERAL jsonb_populate_record(NULL::f1.sessions,r.raw_record || jsonb_build_object('source_record_id',r.record_id)) x
  WHERE p.run_id=target_run AND p.endpoint='sessions'
  ON CONFLICT(session_key) DO UPDATE SET meeting_key=EXCLUDED.meeting_key,year=EXCLUDED.year,session_name=EXCLUDED.session_name,session_type=EXCLUDED.session_type,circuit_key=EXCLUDED.circuit_key,circuit_short_name=EXCLUDED.circuit_short_name,country_code=EXCLUDED.country_code,country_key=EXCLUDED.country_key,country_name=EXCLUDED.country_name,location=EXCLUDED.location,date_start=EXCLUDED.date_start,date_end=EXCLUDED.date_end,gmt_offset=EXCLUDED.gmt_offset,is_cancelled=EXCLUDED.is_cancelled,source_record_id=EXCLUDED.source_record_id;
  INSERT INTO f1.session_entries(session_key,driver_number,broadcast_name,first_name,last_name,full_name,name_acronym,team_name,team_colour,country_code,headshot_url,source_record_id)
  SELECT x.session_key,x.driver_number,x.broadcast_name,x.first_name,x.last_name,x.full_name,x.name_acronym,x.team_name,x.team_colour,x.country_code,x.headshot_url,x.source_record_id FROM f1_ingest.source_records r JOIN f1_ingest.source_payloads p USING(payload_id)
  CROSS JOIN LATERAL jsonb_populate_record(NULL::f1.session_entries,r.raw_record || jsonb_build_object('source_record_id',r.record_id)) x
  WHERE p.run_id=target_run AND p.endpoint='drivers'
  ;
  INSERT INTO f1.laps(session_key,driver_number,lap_number,date_start,lap_duration,duration_sector_1,duration_sector_2,duration_sector_3,is_pit_out_lap,i1_speed,i2_speed,st_speed,segments_sector_1,segments_sector_2,segments_sector_3,source_record_id)
  SELECT x.session_key,x.driver_number,x.lap_number,x.date_start,x.lap_duration,x.duration_sector_1,x.duration_sector_2,x.duration_sector_3,x.is_pit_out_lap,x.i1_speed,x.i2_speed,x.st_speed,x.segments_sector_1,x.segments_sector_2,x.segments_sector_3,x.source_record_id FROM f1_ingest.source_records r JOIN f1_ingest.source_payloads p USING(payload_id)
  CROSS JOIN LATERAL jsonb_populate_record(NULL::f1.laps,r.raw_record || jsonb_build_object('source_record_id',r.record_id)) x
  WHERE p.run_id=target_run AND p.endpoint='laps'
  ;
  INSERT INTO f1.stints(session_key,driver_number,stint_number,compound,lap_start,lap_end,tyre_age_at_start,source_record_id)
  SELECT x.session_key,x.driver_number,x.stint_number,x.compound,x.lap_start,x.lap_end,x.tyre_age_at_start,x.source_record_id FROM f1_ingest.source_records r JOIN f1_ingest.source_payloads p USING(payload_id)
  CROSS JOIN LATERAL jsonb_populate_record(NULL::f1.stints,r.raw_record || jsonb_build_object('source_record_id',r.record_id)) x
  WHERE p.run_id=target_run AND p.endpoint='stints'
  ;
  INSERT INTO f1.pit_events(session_key,driver_number,date,lap_number,lane_duration,pit_duration,stop_duration,source_record_id)
  SELECT x.session_key,x.driver_number,x.date,x.lap_number,x.lane_duration,x.pit_duration,x.stop_duration,x.source_record_id FROM f1_ingest.source_records r JOIN f1_ingest.source_payloads p USING(payload_id)
  CROSS JOIN LATERAL jsonb_populate_record(NULL::f1.pit_events,r.raw_record || jsonb_build_object('source_record_id',r.record_id)) x
  WHERE p.run_id=target_run AND p.endpoint='pit'
  ;
  INSERT INTO f1.race_control_events(session_key,driver_number,date,lap_number,category,flag,message,scope,sector,qualifying_phase,source_record_id)
  SELECT x.session_key,x.driver_number,x.date,x.lap_number,x.category,x.flag,x.message,x.scope,x.sector,x.qualifying_phase,x.source_record_id FROM f1_ingest.source_records r JOIN f1_ingest.source_payloads p USING(payload_id)
  CROSS JOIN LATERAL jsonb_populate_record(NULL::f1.race_control_events,r.raw_record || jsonb_build_object('source_record_id',r.record_id)) x
  WHERE p.run_id=target_run AND p.endpoint='race_control'
  ;
  INSERT INTO f1.session_datasets(session_key,run_id,data_version,endpoint_counts)
  VALUES(target,target_run,version,current_counts)
  ON CONFLICT(session_key) DO UPDATE SET run_id=EXCLUDED.run_id,data_version=EXCLUDED.data_version,
   published_at=now(),endpoint_counts=EXCLUDED.endpoint_counts;
  DELETE FROM f1_ingest.source_records WHERE payload_id IN
   (SELECT payload_id FROM f1_ingest.source_payloads WHERE run_id IN
    (SELECT run_id FROM f1_ingest.ingestion_runs WHERE session_key=target AND run_id<>target_run));
  DELETE FROM f1_ingest.source_payloads WHERE run_id IN
   (SELECT run_id FROM f1_ingest.ingestion_runs WHERE session_key=target AND run_id<>target_run);
 END IF;
 UPDATE f1_ingest.ingestion_runs SET status='succeeded',finished_at=now(),
 changes=jsonb_build_object('policy','replace complete session; absent rows deleted; event IDs may change',
 'source_object_changes',differences,'previous_counts',previous,'current_counts',current_counts,'same_version',
 EXISTS(SELECT 1 FROM f1.session_datasets WHERE session_key=target AND run_id<>target_run AND data_version=version))
 WHERE run_id=target_run;
 DELETE FROM f1_ingest.staged_payloads WHERE run_id=target_run;
 -- Keep latest successful source payloads plus at most 20 compact run summaries.
 DELETE FROM f1_ingest.ingestion_runs WHERE session_key=target AND run_id NOT IN
  (SELECT run_id FROM f1_ingest.ingestion_runs WHERE session_key=target ORDER BY started_at DESC,run_id DESC LIMIT 20)
 AND run_id NOT IN(SELECT run_id FROM f1.session_datasets);
END $$;
REVOKE ALL ON FUNCTION f1_ingest.publish(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f1_ingest.publish(uuid) TO f1_ingestor;
ALTER TABLE f1_ingest.ingestion_runs ADD COLUMN IF NOT EXISTS pipeline_version text;
CREATE FUNCTION f1_ingest.fail_run(target_run uuid, detail text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog, f1_ingest AS $$
DECLARE target integer;
BEGIN
 SELECT session_key INTO STRICT target FROM f1_ingest.ingestion_runs WHERE run_id=target_run AND status='running';
 IF target<>9644 THEN RAISE EXCEPTION 'not a Stage 4 run'; END IF;
 PERFORM pg_advisory_xact_lock(713004,target);
 UPDATE f1_ingest.ingestion_runs SET status='failed',finished_at=now(),error_summary=left(detail,2000) WHERE run_id=target_run;
 DELETE FROM f1_ingest.staged_payloads WHERE run_id=target_run;
 DELETE FROM f1_ingest.ingestion_runs WHERE session_key=target AND status<>'running'
 AND run_id NOT IN(SELECT run_id FROM f1_ingest.ingestion_runs WHERE session_key=target ORDER BY started_at DESC,run_id DESC LIMIT 20)
 AND run_id NOT IN(SELECT run_id FROM f1.session_datasets)
 AND run_id NOT IN(SELECT run_id FROM f1_ingest.source_payloads);
END $$;
REVOKE ALL ON FUNCTION f1_ingest.fail_run(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f1_ingest.fail_run(uuid,text) TO f1_ingestor;
