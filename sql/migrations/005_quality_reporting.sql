-- 005: versioned quality findings and one assessment per source lap observation.
CREATE TABLE f1.quality_reports (
 report_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_key integer NOT NULL CHECK(session_key>0),
 data_version text NOT NULL, quality_version text NOT NULL,
 generated_at timestamptz NOT NULL DEFAULT now(),
 summary jsonb NOT NULL, findings jsonb NOT NULL, source_counts jsonb NOT NULL,
 control_windows jsonb NOT NULL, policy jsonb NOT NULL,
 UNIQUE(session_key,data_version,quality_version)
);
CREATE TABLE f1.lap_assessments (
 report_id uuid NOT NULL REFERENCES f1.quality_reports ON DELETE CASCADE,
 source_ordinal integer NOT NULL CHECK(source_ordinal>=0),
 driver_number integer, lap_number integer, lap_duration numeric,
 interval_start timestamptz, interval_end timestamptz,
 interval_source text NOT NULL CHECK(interval_source IN ('duration','estimated_next_start','unavailable')),
 exclusions text[] NOT NULL, warnings text[] NOT NULL, evidence jsonb NOT NULL,
 pace_candidate boolean NOT NULL, stint_candidate boolean NOT NULL,
 control_state text NOT NULL CHECK(control_state IN ('neutralized_overlap','yellow_warning','possible_interruption','no_known_interruption','unmappable')),
 green_flag_status text NOT NULL CHECK(green_flag_status='not_established'),
 PRIMARY KEY(report_id,source_ordinal)
);
CREATE INDEX assessments_driver_lap_idx ON f1.lap_assessments(report_id,driver_number,lap_number);
-- No FK to mutable current laps/raw records: these results survive version refresh
-- without blocking Stage 4's raw retention or silently changing historical findings.
GRANT SELECT ON f1.quality_reports,f1.lap_assessments TO f1_app_reader;
GRANT SELECT,INSERT,UPDATE ON f1.quality_reports,f1.lap_assessments TO f1_ingestor;
REVOKE ALL ON f1.quality_reports,f1.lap_assessments FROM PUBLIC;
CREATE FUNCTION f1_ingest.prune_quality(target integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF target<>9644 THEN RAISE EXCEPTION 'Only curated Stage 4 session is supported'; END IF;
 DELETE FROM f1.quality_reports WHERE session_key=target AND report_id NOT IN
 (SELECT report_id FROM f1.quality_reports WHERE session_key=target ORDER BY generated_at DESC,report_id DESC LIMIT 20);
END $$;
REVOKE ALL ON FUNCTION f1_ingest.prune_quality(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION f1_ingest.prune_quality(integer) TO f1_ingestor;
COMMENT ON TABLE f1.lap_assessments IS 'Derived eligibility; never deletes or changes raw/typed laps. Candidate does not mean proven green-flag.';
