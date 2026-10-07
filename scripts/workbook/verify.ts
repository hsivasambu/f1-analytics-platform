import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { connection,safeError } from '../db/shared';
import { fixtureBundle,ingest } from '../ingest/pipeline';
import { workbookFixture } from './fixture';
import { defaults,execute,requireCurrentReport } from './shared';
const close=(actual:unknown,expected:number)=>assert.ok(Math.abs(Number(actual)-expected)<1e-9,`${actual} differs from ${expected}`);
async function main(){
 const args=process.argv.slice(2);assert.ok(args.length===0||(args.length===1&&args[0]==='--show'),'Use sql:verify [--show]');
 const values=parseEnv(await readFile('.env.ingestion-test.local','utf8'));
 const url=new URL(values.MIGRATION_DATABASE_URL!);
 assert.ok(['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname.includes('test'),'Only dedicated local test database; never Neon');
 const owner=connection(values.MIGRATION_DATABASE_URL),writer=connection(values.INGESTION_DATABASE_URL),reader=connection(values.APP_DATABASE_URL);
 let ownsFixture=false;
 try{await owner.connect();await writer.connect();await reader.connect();
  assert.equal((await owner.query('SELECT count(*)::int AS n FROM f1.sessions')).rows[0].n,0,'Test database must start empty');ownsFixture=true;
  const rows=workbookFixture();
  await ingest(writer,9644,async progress=>{const bundle=fixtureBundle(rows);await progress(bundle);return bundle;},'fixture');
  await reader.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await requireCurrentReport(reader,9644);
  const results=[];
  for(let n=1;n<=10;n++)results.push(await execute(reader,n));
  if(args[0]==='--show')for(let i=0;i<results.length;i++)console.dir({lesson:i+1,synthetic_results:results[i]},{depth:null});
  assert.equal(Number(results[0][0].laps),13);assert.equal(Number(results[0][0].pace_candidates),8);
  assert.equal(Number(results[0][0].missing_durations),1);
  const coverage=results[1].find(r=>r.driver_number===99)!;assert.equal(Number(coverage.recorded_laps),0);assert.equal(coverage.first_recorded_lap,null);
  assert.equal(Number(results[1].find(r=>r.driver_number===44)!.interior_missing_numbers),1);
  close(results[2].find(r=>r.driver_number===1)!.fastest_seconds,90);
  close(results[3].find(r=>r.driver_number===1)!.median_seconds,92);close(results[3].find(r=>r.driver_number===44)!.median_seconds,95);
  assert.equal(results[3].find(r=>r.driver_number===99)!.median_seconds,null,'No sample does not become zero');
  const matched=results[4][0];assert.equal(Number(matched.matched_sample_count),3);assert.deepEqual(matched.matched_lap_numbers,[2,3,7]);
  close(matched.mean_a_minus_b_seconds,-7/3);close(matched.median_a_minus_b_seconds,-3);
  const stint=results[5].find(r=>r.driver_number===1&&r.stint_number===1)!;assert.equal(Number(stint.eligible_sample_count),2);close(stint.median_seconds,91);
  close(results[6].find(r=>r.driver_number===1&&r.lap_number===3)!.change_seconds,2);
  assert.equal(results[6].find(r=>r.driver_number===1&&r.lap_number===7)!.change_seconds,null,'Do not bridge excluded predecessor');
  assert.equal(results[6].find(r=>r.driver_number===44&&r.lap_number===7)!.change_seconds,null,'Do not bridge missing lap six');
  close(results[7].find(r=>r.driver_number===44&&r.lap_number===5)!.complete_three_lap_mean_seconds,289/3);
  const gap=results[7].find(r=>r.driver_number===44&&r.lap_number===7)!;assert.equal(Number(gap.observed_window_laps),2);assert.equal(gap.complete_three_lap_mean_seconds,null);close(gap.available_mean_seconds,100);
  assert.equal(results[8].length,3);assert.equal(results[8].at(-1)!.event_time,null);assert.equal(results[8].find(r=>r.event_type==='pit')!.details.stationary_seconds,null);
  const strict=results[9].find(r=>r.mode==='strict')!,relaxed=results[9].find(r=>r.mode==='allow_known_pit_laps')!;
  assert.equal(Number(strict.matched_sample_count),3);close(strict.mean_a_minus_b_seconds,-7/3);
  assert.equal(Number(relaxed.matched_sample_count),5);close(relaxed.mean_a_minus_b_seconds,2.6);
  // Filter after window computation still has lap-two history for selected lap three.
  const filtered=await execute(reader,7,{...defaults,fromLap:3,toLap:3});close(filtered.find(r=>r.driver_number===1)!.change_seconds,2);
  const empty=await execute(reader,5,{...defaults,driverB:99});assert.equal(Number(empty[0].matched_sample_count),0);assert.equal(empty[0].mean_a_minus_b_seconds,null);
  const even=await execute(reader,4,{...defaults,toLap:3});close(even.find(r=>r.driver_number===1)!.median_seconds,91);
  // Execute the two deliberately wrong exercise variants, without changing answer files.
  const context=await readFile('sql/workbook/context.sql','utf8');
  const parameters=[9644,1,44,1,1000,'quality-v1'];
  const rollingSql=await readFile('sql/workbook/answers/08-rolling-pace.sql','utf8');
  const rowFrame=(await reader.query(context+'\n'+rollingSql.replace('RANGE BETWEEN 2 PRECEDING','ROWS BETWEEN 2 PRECEDING'),parameters)).rows;
  close(rowFrame.find(r=>r.driver_number===44&&r.lap_number===7)!.complete_three_lap_mean_seconds,293/3);
  const matchedSql=await readFile('sql/workbook/answers/05-matched-comparison.sql','utf8');
  const badJoin=(await reader.query(context+'\n'+matchedSql.replace('AND a.lap_number=b.lap_number',''),parameters)).rows[0];
  assert.equal(Number(badJoin.matched_sample_count),15);close(badJoin.mean_a_minus_b_seconds,-47/15);
  await reader.query('COMMIT');
  // Refresh only the disposable fixture to verify ties.
  rows.laps.find(l=>l.driver_number===1&&l.lap_number===7)!.lap_duration=90;
  await ingest(writer,9644,async progress=>{const b=fixtureBundle(rows);await progress(b);return b;},'fixture');
  assert.equal((await execute(reader,3)).filter(r=>r.driver_number===1).length,2,'Every fastest tie is returned');
  rows.race_control.push(
   {session_key:9644,date:'2024-01-01T00:03:10Z',category:'SafetyCar',message:'SAFETY CAR DEPLOYED'},
   {session_key:9644,date:'2024-01-01T00:04:42Z',category:'SafetyCar',message:'SAFETY CAR ENDED'});
  await ingest(writer,9644,async progress=>{const b=fixtureBundle(rows);await progress(b);return b;},'fixture');
  for(const mode of await execute(reader,10))assert.ok(!(mode.matched_lap_numbers??[]).some((lap:number)=>[2,3].includes(lap)),'Pit relaxation cannot admit neutralization or boundary exclusions');
  console.log('PASS: all ten SQL lessons; counts/NULLs/percentiles; matched samples and sign; stint join; consecutive LAG; lap-number rolling windows; event preservation; sensitivity; zero matches; tied fastest laps');
 }finally{
  await reader.query('ROLLBACK').catch(()=>undefined);
  if(ownsFixture){await owner.query('BEGIN');
   for(const table of ['quality_reports','session_datasets','laps','stints','pit_events','race_control_events','session_entries','sessions'])await owner.query(`DELETE FROM f1.${table}`);
   for(const table of ['staged_payloads','source_records','source_payloads','ingestion_runs'])await owner.query(`DELETE FROM f1_ingest.${table}`);
   await owner.query('COMMIT');
  }
  await Promise.all([owner.end(),writer.end(),reader.end()]);
 }
}
main().catch(e=>{console.error(safeError(e));process.exitCode=1;});
