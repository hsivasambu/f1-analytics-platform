, timeline AS (
 SELECT e.date AS event_time,'pit'::text AS event_type,e.pit_event_id AS event_id,
  e.driver_number,e.lap_number AS source_lap_number,e.source_record_id,
  jsonb_build_object('lane_seconds',e.lane_duration,'deprecated_pit_seconds',e.pit_duration,
                     'stationary_seconds',e.stop_duration) AS details
 FROM f1.pit_events e JOIN p USING(session_key)
 UNION ALL
 SELECT e.date,'race_control',e.race_control_event_id,e.driver_number,e.lap_number,e.source_record_id,
  jsonb_build_object('category',e.category,'flag',e.flag,'scope',e.scope,'sector',e.sector,'message',e.message)
 FROM f1.race_control_events e JOIN p USING(session_key)
)
SELECT * FROM timeline ORDER BY event_time NULLS LAST,event_type,event_id;
