-- Parameters: session_key, session-scoped driver number, lap number.
SELECT l.session_key,l.driver_number,l.lap_number,l.lap_duration,
 r.raw_record,r.source_ordinal,p.endpoint,p.request_url,p.retrieved_at,
 p.response_sha256,p.run_id,n.pipeline_version,d.data_version
FROM f1.laps l
JOIN f1_ingest.source_records r ON r.record_id=l.source_record_id
JOIN f1_ingest.source_payloads p USING(payload_id)
JOIN f1_ingest.ingestion_runs n USING(run_id)
JOIN f1.session_datasets d ON d.session_key=l.session_key
WHERE l.session_key=$1 AND l.driver_number=$2 AND l.lap_number=$3;
