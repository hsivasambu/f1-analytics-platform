SELECT e.driver_number,e.full_name,
 count(o.lap_number) AS recorded_laps,
 count(o.lap_duration) AS known_durations,
 count(o.lap_number) FILTER (WHERE o.pace_candidate) AS eligible_laps,
 min(o.lap_number) AS first_recorded_lap,max(o.lap_number) AS last_recorded_lap,
 max(o.lap_number)-min(o.lap_number)+1-count(o.lap_number) AS interior_missing_numbers
FROM f1.session_entries e JOIN p USING(session_key)
LEFT JOIN range_laps o
 ON o.session_key=e.session_key AND o.driver_number=e.driver_number
GROUP BY e.driver_number,e.full_name ORDER BY e.driver_number;
