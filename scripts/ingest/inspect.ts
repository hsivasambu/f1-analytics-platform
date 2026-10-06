import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { configuration, connection, environment, safeError } from '../db/shared';
async function main() {
 const [key,...flags]=process.argv.slice(2);assert.equal(key,'9644','Usage: npm run data:inspect -- 9644 [--env development|production]');
 const env=environment(flags), {values}=await configuration(env);const client=connection(values.MIGRATION_DATABASE_URL);
 try {await client.connect();await client.query('BEGIN READ ONLY');
 console.table((await client.query(`SELECT 'sessions' AS table_name,count(*)::int AS rows FROM f1.sessions WHERE session_key=$1
 UNION ALL SELECT 'entries',count(*)::int FROM f1.session_entries WHERE session_key=$1
 UNION ALL SELECT 'laps',count(*)::int FROM f1.laps WHERE session_key=$1
 UNION ALL SELECT 'stints',count(*)::int FROM f1.stints WHERE session_key=$1
 UNION ALL SELECT 'pit',count(*)::int FROM f1.pit_events WHERE session_key=$1
 UNION ALL SELECT 'race_control',count(*)::int FROM f1.race_control_events WHERE session_key=$1`,[Number(key)])).rows);
 console.log(JSON.stringify((await client.query(`SELECT d.*, (SELECT count(*) FROM f1_ingest.source_payloads p WHERE p.run_id=d.run_id) AS retained_payloads,
 (SELECT count(*) FROM f1_ingest.source_records r JOIN f1_ingest.source_payloads p USING(payload_id) WHERE p.run_id=d.run_id) AS retained_records
 FROM f1.session_datasets d WHERE session_key=$1`,[Number(key)])).rows,null,2));
 console.table((await client.query('SELECT count(*)::int AS total,count(lap_duration)::int AS known,count(*) FILTER(WHERE lap_duration IS NULL)::int AS unknown FROM f1.laps WHERE session_key=$1',[Number(key)])).rows);
 console.log(JSON.stringify((await client.query(await readFile('sql/examples/lap_provenance.sql','utf8'),[Number(key),1,1])).rows,null,2));
 await client.query('ROLLBACK');}finally{await client.end();}
}
main().catch(e=>{console.error(safeError(e));process.exitCode=1;});
