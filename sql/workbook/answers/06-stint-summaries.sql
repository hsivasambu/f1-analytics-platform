SELECT s.driver_number,s.stint_number,s.compound,s.lap_start,s.lap_end,s.tyre_age_at_start,
 count(o.lap_number) AS eligible_sample_count,
 min(o.lap_number) AS first_eligible_lap,max(o.lap_number) AS last_eligible_lap,
 avg(o.lap_duration) AS mean_seconds,
 percentile_cont(0.5) WITHIN GROUP (ORDER BY o.lap_duration::double precision) AS median_seconds
FROM f1.stints s JOIN p USING(session_key)
LEFT JOIN range_laps o
 ON o.session_key=s.session_key AND o.driver_number=s.driver_number
 AND o.lap_number BETWEEN s.lap_start AND s.lap_end AND o.stint_candidate
GROUP BY s.session_key,s.driver_number,s.stint_number
ORDER BY s.driver_number,s.stint_number;
