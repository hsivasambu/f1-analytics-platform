-- Shared CTEs prepended by the runner. Parameters are bound, never interpolated.
WITH p AS (
 SELECT $1::integer AS session_key, $2::integer AS driver_a,
        $3::integer AS driver_b, $4::integer AS from_lap,
        $5::integer AS to_lap, $6::text AS quality_version
), current_report AS (
 SELECT q.* FROM f1.session_datasets d
 JOIN f1.quality_reports q
   ON q.session_key=d.session_key AND q.data_version=d.data_version
 JOIN p ON p.session_key=d.session_key AND p.quality_version=q.quality_version
), observations AS (
 SELECT l.*, a.pace_candidate IS TRUE AS pace_candidate,
        a.stint_candidate IS TRUE AS stint_candidate,
        a.exclusions, a.warnings, a.control_state, a.green_flag_status
 FROM f1.laps l JOIN p USING(session_key)
 JOIN current_report q USING(session_key)
 LEFT JOIN f1.lap_assessments a
   ON a.report_id=q.report_id AND a.driver_number=l.driver_number
  AND a.lap_number=l.lap_number
), range_laps AS (
 SELECT o.* FROM observations o CROSS JOIN p
 WHERE o.lap_number BETWEEN p.from_lap AND p.to_lap
)
