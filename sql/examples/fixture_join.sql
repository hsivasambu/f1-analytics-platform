-- Learning join: not a production analytical metric.
SELECT s.session_name, l.driver_number, e.full_name,
       l.lap_number, l.lap_duration, t.stint_number, t.compound
FROM f1.laps l
JOIN f1.sessions s USING (session_key)
JOIN f1.session_entries e USING (session_key, driver_number)
LEFT JOIN f1.stints t
  ON t.session_key = l.session_key AND t.driver_number = l.driver_number
 AND l.lap_number BETWEEN t.lap_start AND t.lap_end
WHERE l.session_key IN (900000001, 900000002)
ORDER BY l.session_key, l.lap_number;
