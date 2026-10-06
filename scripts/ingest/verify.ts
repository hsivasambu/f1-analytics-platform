import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import type { Client } from 'pg';
import { connection, safeError } from '../db/shared';
import { fixtureBundle, ingest } from './pipeline';
import { fixtureRows } from './fixture';
async function main() {
 const values=parseEnv(await readFile('.env.ingestion-test.local','utf8'));
 const url=new URL(values.MIGRATION_DATABASE_URL!);
 assert.ok(['localhost','127.0.0.1'].includes(url.hostname) && url.pathname.includes('test'), 'Only dedicated local test database; never Neon');
 const owner=connection(values.MIGRATION_DATABASE_URL),writer=connection(values.INGESTION_DATABASE_URL),reader=connection(values.APP_DATABASE_URL);
 try {
  await owner.connect(); await writer.connect(); await reader.connect();
  assert.equal((await owner.query('SELECT count(*)::int AS n FROM f1.sessions')).rows[0].n,0,'Test database must start empty');
  const load=(rows=fixtureRows())=>ingest(writer,9644,async progress=>{const b=fixtureBundle(rows);await progress(b);return b;},'fixture');
  const first=await load(); const second=await load();
  assert.equal(first.data_version,second.data_version);
  assert.equal(second.changes.same_version,true);
  assert.equal((await owner.query('SELECT count(*)::int AS n FROM f1.laps')).rows[0].n,2);
  assert.equal((await owner.query('SELECT count(*)::int AS n FROM f1_ingest.source_payloads')).rows[0].n,6);
  assert.equal((await owner.query('SELECT count(*)::int AS n FROM f1.pit_events')).rows[0].n,2);
  const snapshot=async()=>JSON.stringify((await reader.query('SELECT * FROM f1.laps ORDER BY lap_number')).rows);
  const before=await snapshot();
  const malformed=fixtureRows(); malformed.laps[0].lap_duration='bad'; await assert.rejects(()=>load(malformed)); assert.equal(await snapshot(),before);
  await assert.rejects(()=>ingest(writer,9644,async()=>{throw new Error('simulated temporary endpoint outage');},'fixture')); assert.equal(await snapshot(),before);
  const badSql=fixtureRows();badSql.stints[0].tyre_age_at_start=-1;await assert.rejects(()=>load(badSql));assert.equal(await snapshot(),before);
  assert.equal((await owner.query('SELECT count(*)::int AS n FROM f1_ingest.ingestion_runs WHERE status=\'failed\'')).rows[0].n,3);
  const corrected=fixtureRows();corrected.laps=corrected.laps.slice(0,1);corrected.laps[0].lap_duration=89.5;
  // Inspect a different real reader after SQL publication but before its COMMIT.
  const proxy=new Proxy(writer,{get(target,prop){if(prop==='query') return async(text:string,args?:unknown[])=>{
   const result=await target.query(text,args);if(text==='SELECT f1_ingest.publish($1)')assert.equal(await snapshot(),before,'Reader must still see previous committed race');return result;
  };const v=Reflect.get(target,prop);return typeof v==='function'?v.bind(target):v;}}) as Client;
  const updated=await ingest(proxy,9644,async progress=>{const b=fixtureBundle(corrected);await progress(b);return b;},'fixture');
  assert.notEqual(updated.data_version,first.data_version);
  assert.deepEqual(updated.changes.source_object_changes.laps,{added_objects:1,removed_objects:2});
  assert.equal((await reader.query('SELECT lap_duration FROM f1.laps')).rows[0].lap_duration,'89.5');
  assert.equal((await owner.query('SELECT count(*)::int AS n FROM f1_ingest.source_payloads')).rows[0].n,6);
  const trace=await owner.query(`SELECT l.lap_duration,r.raw_record,p.response_sha256,p.request_url,p.run_id
   FROM f1.laps l JOIN f1_ingest.source_records r ON r.record_id=l.source_record_id JOIN f1_ingest.source_payloads p USING(payload_id)`);
  assert.equal(trace.rows[0].raw_record.lap_duration,89.5);assert.equal(trace.rows[0].run_id,updated.run_id);
  for(let i=0;i<22;i++) await load(corrected);
  assert.ok((await owner.query('SELECT count(*)::int AS n FROM f1_ingest.ingestion_runs')).rows[0].n<=21);
  assert.equal((await owner.query('SELECT count(*)::int AS n FROM f1_ingest.staged_payloads')).rows[0].n,0);
  await assert.rejects(()=>reader.query('SELECT f1_ingest.publish($1)',[updated.run_id]),e=>(e as {code:string}).code==='42501');
  await assert.rejects(()=>writer.query('DELETE FROM f1.laps'),e=>(e as {code:string}).code==='42501');
  console.log('PASS: repeat-load counts/raw retention; malformed input, outage and SQL failure recovery; atomic reader visibility; corrections/deletions; source trace; bounded history; reader/write permissions');
 } finally {
  // Named local disposable fixture database only. Preserve schema/roles for repeat testing.
  await owner.query('BEGIN');
  for(const t of ['session_datasets','laps','stints','pit_events','race_control_events','session_entries','sessions']) await owner.query(`DELETE FROM f1.${t}`);
  for(const t of ['staged_payloads','source_records','source_payloads','ingestion_runs']) await owner.query(`DELETE FROM f1_ingest.${t}`);
  await owner.query('COMMIT');
  await Promise.all([owner.end(),writer.end(),reader.end()]);
 }
}
main().catch(e=>{console.error(safeError(e));process.exitCode=1;});
