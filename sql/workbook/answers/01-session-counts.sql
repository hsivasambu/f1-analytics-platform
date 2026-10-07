-- Separate scalar counts avoid multiplying rows by joining several child tables.
SELECT s.session_key,s.session_name,s.year,
 (SELECT count(*) FROM f1.session_entries e WHERE e.session_key=s.session_key) AS entries,
 (SELECT count(*) FROM observations) AS laps,
 (SELECT count(*) FROM observations WHERE lap_duration IS NULL) AS missing_durations,
 (SELECT count(*) FROM observations WHERE pace_candidate) AS pace_candidates,
 (SELECT count(*) FROM f1.stints t WHERE t.session_key=s.session_key) AS stints,
 (SELECT count(*) FROM f1.pit_events t WHERE t.session_key=s.session_key) AS pit_events,
 (SELECT count(*) FROM f1.race_control_events t WHERE t.session_key=s.session_key) AS control_events
FROM f1.sessions s JOIN p USING(session_key);
