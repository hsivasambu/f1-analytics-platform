, eligible AS (SELECT * FROM range_laps WHERE pace_candidate),
best AS (
 SELECT session_key,driver_number,min(lap_duration) AS fastest_seconds,
        count(*) AS eligible_sample_count
 FROM eligible GROUP BY session_key,driver_number
)
-- Return every tie, rather than arbitrarily choosing a lap.
SELECT e.driver_number,e.lap_number,b.fastest_seconds,b.eligible_sample_count
FROM best b JOIN eligible e
 ON e.session_key=b.session_key AND e.driver_number=b.driver_number
 AND e.lap_duration=b.fastest_seconds
ORDER BY e.driver_number,e.lap_number;
