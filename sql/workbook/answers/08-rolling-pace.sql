, rolling AS (
 SELECT o.*,
  count(*) OVER w AS observed_window_laps,
  count(*) FILTER (WHERE pace_candidate) OVER w AS eligible_window_laps,
  avg(lap_duration) FILTER (WHERE pace_candidate) OVER w AS available_mean_seconds
 FROM observations o
 -- RANGE uses lap-number distance, not the previous two surviving rows.
 WINDOW w AS (PARTITION BY session_key,driver_number ORDER BY lap_number
              RANGE BETWEEN 2 PRECEDING AND CURRENT ROW)
)
SELECT r.driver_number,r.lap_number,r.observed_window_laps,r.eligible_window_laps,
 r.available_mean_seconds,
 CASE WHEN r.observed_window_laps=3 AND r.eligible_window_laps=3
      THEN r.available_mean_seconds END AS complete_three_lap_mean_seconds
FROM rolling r CROSS JOIN p
WHERE r.driver_number IN (p.driver_a,p.driver_b)
 AND r.lap_number BETWEEN p.from_lap AND p.to_lap
ORDER BY r.driver_number,r.lap_number;
