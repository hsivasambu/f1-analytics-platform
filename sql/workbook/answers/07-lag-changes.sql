, history AS (
 SELECT o.*,lag(lap_number) OVER w AS previous_lap,
   lag(lap_duration) OVER w AS previous_seconds,
   lag(pace_candidate) OVER w AS previous_eligible
 FROM observations o
 WINDOW w AS (PARTITION BY session_key,driver_number ORDER BY lap_number)
)
SELECT h.driver_number,h.lap_number,h.lap_duration,h.pace_candidate,
 h.previous_lap,h.previous_seconds,
 CASE WHEN h.pace_candidate AND h.previous_eligible AND h.previous_lap=h.lap_number-1
      THEN h.lap_duration-h.previous_seconds END AS change_seconds,
 h.exclusions
FROM history h CROSS JOIN p
WHERE h.driver_number IN (p.driver_a,p.driver_b)
 AND h.lap_number BETWEEN p.from_lap AND p.to_lap
ORDER BY h.driver_number,h.lap_number;
