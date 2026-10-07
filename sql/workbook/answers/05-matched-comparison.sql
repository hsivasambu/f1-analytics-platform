, eligible AS (SELECT * FROM range_laps WHERE pace_candidate),
matched AS (
 SELECT a.lap_number,a.lap_duration AS a_seconds,b.lap_duration AS b_seconds,
        a.lap_duration-b.lap_duration AS a_minus_b_seconds
 FROM eligible a JOIN eligible b
   ON a.session_key=b.session_key AND a.lap_number=b.lap_number
 CROSS JOIN p WHERE a.driver_number=p.driver_a AND b.driver_number=p.driver_b
)
SELECT p.driver_a,p.driver_b,count(m.lap_number) AS matched_sample_count,
 (SELECT count(*) FROM eligible e WHERE e.driver_number=p.driver_a) AS a_eligible_count,
 (SELECT count(*) FROM eligible e WHERE e.driver_number=p.driver_b) AS b_eligible_count,
 min(m.lap_number) AS first_matched_lap,max(m.lap_number) AS last_matched_lap,
 avg(m.a_seconds) AS a_mean_seconds,avg(m.b_seconds) AS b_mean_seconds,
 avg(m.a_minus_b_seconds) AS mean_a_minus_b_seconds,
 percentile_cont(0.5) WITHIN GROUP (ORDER BY m.a_minus_b_seconds::double precision) AS median_a_minus_b_seconds,
 array_agg(m.lap_number ORDER BY m.lap_number) FILTER (WHERE m.lap_number IS NOT NULL) AS matched_lap_numbers
FROM p LEFT JOIN matched m ON true GROUP BY p.driver_a,p.driver_b;
