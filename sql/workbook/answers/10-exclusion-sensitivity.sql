, modes(mode,ignored_reasons) AS (
 VALUES ('strict',ARRAY[]::text[]),
        ('allow_known_pit_laps',ARRAY['pit_out_lap','pit_event_lap','pit_event_time_overlap']::text[])
), candidates AS (
 SELECT o.*,m.mode FROM range_laps o CROSS JOIN modes m
 WHERE o.exclusions IS NOT NULL AND o.lap_duration>0
  AND NOT EXISTS (SELECT 1 FROM unnest(o.exclusions) reason WHERE NOT(reason=ANY(m.ignored_reasons)))
), matched AS (
 SELECT a.mode,a.lap_number,a.lap_duration-b.lap_duration AS difference_seconds
 FROM candidates a JOIN candidates b
  ON a.session_key=b.session_key AND a.lap_number=b.lap_number AND a.mode=b.mode
 CROSS JOIN p WHERE a.driver_number=p.driver_a AND b.driver_number=p.driver_b
)
SELECT modes.mode,count(m.lap_number) AS matched_sample_count,
 avg(m.difference_seconds) AS mean_a_minus_b_seconds,
 array_agg(m.lap_number ORDER BY m.lap_number) FILTER (WHERE m.lap_number IS NOT NULL) AS matched_lap_numbers
FROM modes LEFT JOIN matched m USING(mode)
GROUP BY modes.mode ORDER BY modes.mode;
