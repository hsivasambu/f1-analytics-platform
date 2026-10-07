SELECT e.driver_number,count(o.lap_number) FILTER (WHERE o.pace_candidate) AS sample_count,
 percentile_cont(0.5) WITHIN GROUP (ORDER BY o.lap_duration::double precision)
   FILTER (WHERE o.pace_candidate) AS median_seconds
FROM f1.session_entries e JOIN p USING(session_key)
LEFT JOIN range_laps o
 ON o.session_key=e.session_key AND o.driver_number=e.driver_number
GROUP BY e.driver_number ORDER BY e.driver_number;
