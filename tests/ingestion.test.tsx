import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureBundle, validate } from '../scripts/ingest/pipeline';
import { fixtureRows } from '../scripts/ingest/fixture';
test('ingestion validates full session joins, natural keys and absent/null/zero values', () => {
  validate(fixtureBundle(fixtureRows()),9644);
  const rows=fixtureRows(); rows.laps[0].lap_duration=0; validate(fixtureBundle(rows),9644);
  delete rows.laps[0].lap_duration; validate(fixtureBundle(rows),9644);
  rows.laps.push({...rows.laps[0]}); assert.throws(()=>validate(fixtureBundle(rows),9644),/duplicate/);
});
test('malformed, incomplete, wrong-session, orphan and nonfinite records fail before publishing', () => {
  for(const change of [
    (r: ReturnType<typeof fixtureRows>)=>{r.laps[0].lap_duration='90';},
    (r: ReturnType<typeof fixtureRows>)=>{r.laps[0].lap_duration=Infinity;},
    (r: ReturnType<typeof fixtureRows>)=>{r.laps[0].date_start='2024-01-01';},
    (r: ReturnType<typeof fixtureRows>)=>{r.laps[0].driver_number=99;},
    (r: ReturnType<typeof fixtureRows>)=>{r.laps[0].session_key=9655;},
    (r: ReturnType<typeof fixtureRows>)=>{r.pit=[];},
  ]) {const r=fixtureRows();change(r);assert.throws(()=>validate(fixtureBundle(r),9644));}
  const b=fixtureBundle(fixtureRows()); b.laps.raw='{}'; assert.throws(()=>validate(b,9644),/array/);
  assert.throws(()=>validate(fixtureBundle(fixtureRows()),9655),/9644/);
});
