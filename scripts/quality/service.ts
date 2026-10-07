import type { Client } from 'pg';
import { analyze, ENDPOINTS, QUALITY_VERSION, type Data } from './core';
import type { Row } from '../openf1/core';
const tables={sessions:'sessions',drivers:'session_entries',laps:'laps',stints:'stints',pit:'pit_events',race_control:'race_control_events'};
export async function recordQuality(client: Client,key:number) {
  const dataset=(await client.query('SELECT * FROM f1.session_datasets WHERE session_key=$1',[key])).rows[0];
  if(!dataset)throw new Error('Ingest this historical session before reporting quality');
  const packets=await client.query('SELECT endpoint,raw_response FROM f1_ingest.source_payloads WHERE run_id=$1',[dataset.run_id]);
  const empty=():Data=>({sessions:[],drivers:[],laps:[],stints:[],pit:[],race_control:[]});
  const raw=empty();
  for(const p of packets.rows)raw[p.endpoint as keyof Data]=JSON.parse(p.raw_response);
  const typed=empty();
  for(const endpoint of ENDPOINTS) typed[endpoint]=(await client.query(`SELECT * FROM f1.${tables[endpoint]} WHERE session_key=$1`,[key])).rows as Row[];
  const report=analyze(raw,dataset.endpoint_counts,typed);
  const saved=await client.query(`INSERT INTO f1.quality_reports(session_key,data_version,quality_version,summary,findings,source_counts,control_windows,policy)
    VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb)
    ON CONFLICT(session_key,data_version,quality_version) DO UPDATE SET generated_at=now(),summary=EXCLUDED.summary,findings=EXCLUDED.findings,
      source_counts=EXCLUDED.source_counts,control_windows=EXCLUDED.control_windows,policy=EXCLUDED.policy RETURNING report_id`,
    [key,dataset.data_version,QUALITY_VERSION,JSON.stringify(report.summary),JSON.stringify(report.findings),JSON.stringify(report.counts),JSON.stringify(report.control_windows),JSON.stringify(report.policy)]);
  const reportId=saved.rows[0].report_id;
  // Fixed columns and parameterized values: no caller-defined SQL.
  await client.query(`INSERT INTO f1.lap_assessments(report_id,source_ordinal,driver_number,lap_number,lap_duration,
    interval_start,interval_end,interval_source,exclusions,warnings,evidence,pace_candidate,stint_candidate,control_state,green_flag_status)
    SELECT x.report_id,x.source_ordinal,x.driver_number,x.lap_number,x.lap_duration,x.interval_start,x.interval_end,
      x.interval_source,x.exclusions,x.warnings,x.evidence,x.pace_candidate,x.stint_candidate,x.control_state,x.green_flag_status
    FROM jsonb_populate_recordset(NULL::f1.lap_assessments,$1::jsonb) x
    ON CONFLICT(report_id,source_ordinal) DO UPDATE SET driver_number=EXCLUDED.driver_number,lap_number=EXCLUDED.lap_number,lap_duration=EXCLUDED.lap_duration,
    interval_start=EXCLUDED.interval_start,interval_end=EXCLUDED.interval_end,interval_source=EXCLUDED.interval_source,exclusions=EXCLUDED.exclusions,
    warnings=EXCLUDED.warnings,evidence=EXCLUDED.evidence,pace_candidate=EXCLUDED.pace_candidate,stint_candidate=EXCLUDED.stint_candidate,control_state=EXCLUDED.control_state,green_flag_status=EXCLUDED.green_flag_status`,
    [JSON.stringify(report.laps.map(lap=>({report_id:reportId,...lap})))]);
  await client.query('SELECT f1_ingest.prune_quality($1)',[key]);
  return {report_id:reportId,session_key:key,data_version:dataset.data_version,...report};
}
