import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { createClient, type Endpoint, type Row } from '../openf1/core';
import columns from './columns.json';
import { safeError } from '../db/shared';

export const ordered = ['sessions', 'drivers', 'laps', 'stints', 'pit', 'race_control'] as const;
export type Packet = Awaited<ReturnType<ReturnType<typeof createClient>>>;
export type Bundle = Record<Endpoint, Packet>;
export const PIPELINE_VERSION = 'stage4-v1';
const integers = new Set('session_key meeting_key year circuit_key country_key driver_number lap_number stint_number lap_start lap_end tyre_age_at_start sector qualifying_phase'.split(' '));
const numbers = new Set('lap_duration duration_sector_1 duration_sector_2 duration_sector_3 i1_speed i2_speed st_speed lane_duration pit_duration stop_duration'.split(' '));
const dates = new Set(['date', 'date_start', 'date_end']);
export function validate(bundle: Bundle, key: number) {
  assert.equal(key, 9644, 'Stage 4 accepts investigated Las Vegas session 9644 only');
  for (const endpoint of ordered) {
    const packet = bundle[endpoint];
    assert.ok(packet, `Missing ${endpoint}`);
    const parsed: unknown = JSON.parse(packet.raw);
    assert.ok(Array.isArray(parsed) && parsed.length > 0 && parsed.length <= 2000, `${endpoint}: empty/oversized array`);
    assert.ok(Buffer.byteLength(packet.raw) <= 2_000_000, `${endpoint}: oversized bytes`);
    assert.deepEqual(parsed, packet.rows, `${endpoint}: raw/parsed mismatch`);
    const url = new URL(packet.url);
    assert.equal(url.origin, 'https://api.openf1.org');
    assert.equal(url.pathname, `/v1/${endpoint}`);
    assert.deepEqual([...url.searchParams.entries()], [['session_key', String(key)]], 'Full session endpoint only');
    assert.ok(Number.isFinite(Date.parse(packet.retrievedAt)), 'Invalid retrieval timestamp');
    const seen = new Set<string>();
    for (const row of packet.rows) {
      assert.ok(row && typeof row === 'object' && !Array.isArray(row), `${endpoint}: object required`);
      assert.equal(row.session_key, key, `${endpoint}: session mismatch`);
      for (const field of columns[endpoint]) {
        const value = row[field];
        if (value === null || value === undefined) continue;
        if (integers.has(field)) assert.ok(typeof value === 'number' && Number.isSafeInteger(value), `${endpoint}.${field}: integer required`);
        else if (numbers.has(field)) assert.ok(typeof value === 'number' && Number.isFinite(value) && value >= 0, `${endpoint}.${field}: finite nonnegative number required`);
        else if (dates.has(field)) assert.ok(typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)), `${endpoint}.${field}: timestamp with timezone required`);
        else if (field.startsWith('segments_')) assert.ok(Array.isArray(value) && value.every(x => x === null || (typeof x === 'number' && Number.isInteger(x))), `${endpoint}.${field}: segment array required`);
        else if (field.startsWith('is_')) assert.equal(typeof value, 'boolean', `${endpoint}.${field}: boolean required`);
        else assert.equal(typeof value, 'string', `${endpoint}.${field}: string required`);
      }
      const natural = endpoint === 'sessions' ? [row.session_key] : endpoint === 'drivers' ? [row.session_key, row.driver_number]
        : endpoint === 'laps' ? [row.session_key, row.driver_number, row.lap_number]
          : endpoint === 'stints' ? [row.session_key, row.driver_number, row.stint_number] : null;
      if (natural) {
        assert.ok(natural.every(v => typeof v === 'number' && v > 0), `${endpoint}: missing/invalid key`);
        const id = JSON.stringify(natural); assert.ok(!seen.has(id), `${endpoint}: duplicate natural key`); seen.add(id);
      }
    }
  }
  assert.equal(bundle.sessions.rows.length, 1);
  const session = bundle.sessions.rows[0];
  assert.equal(session.session_name, 'Race');
  assert.notEqual(session.is_cancelled, true);
  assert.ok(typeof session.date_end === 'string' && Date.parse(session.date_end) < Date.now() - 30 * 60_000, 'Completed historical race required');
  const drivers = new Set(bundle.drivers.rows.map(r => r.driver_number));
  for (const endpoint of ['laps', 'stints', 'pit', 'race_control'] as const) {
    for (const row of bundle[endpoint].rows) {
      if (endpoint === 'laps' || endpoint === 'stints' || row.driver_number != null)
        assert.ok(drivers.has(row.driver_number), `${endpoint}: driver join orphan`);
    }
  }
}
export function summary(bundle: Partial<Bundle>) {
  return Object.fromEntries(ordered.filter(e => bundle[e]).map(e => [e, {
    endpoint: e, url: bundle[e]!.url, retrieved_at: bundle[e]!.retrievedAt,
    rows: bundle[e]!.rows.length, bytes: Buffer.byteLength(bundle[e]!.raw),
    sha256: createHash('sha256').update(bundle[e]!.raw).digest('hex'),
  }]));
}
export async function ingest(client: Client, key: number, fetchBundle: (progress: (b: Partial<Bundle>) => Promise<void>) => Promise<Bundle>, source: 'openf1' | 'fixture' = 'openf1') {
  assert.equal(key, 9644, 'Stage 4 session key must be 9644');
  const run = randomUUID();
  // One session-scoped lock covers fetch through publication, outside transactions.
  await client.query('SELECT pg_advisory_lock(713004,$1)', [key]);
  try {
    // A killed process releases its lock. Mark its unfinished run before retrying.
    const abandoned = await client.query("SELECT run_id FROM f1_ingest.ingestion_runs WHERE session_key=$1 AND status='running'", [key]);
    for (const row of abandoned.rows) await client.query('SELECT f1_ingest.fail_run($1,$2)', [row.run_id, 'Interrupted previous CLI process; dataset preserved']);
    await client.query("INSERT INTO f1_ingest.ingestion_runs(run_id,source,purpose,session_key,pipeline_version) VALUES($1,$4,'complete session refresh',$2,$3)", [run,key,PIPELINE_VERSION,source]);
    try {
      const bundle = await fetchBundle(async b => { await client.query('UPDATE f1_ingest.ingestion_runs SET endpoint_summary=$2::jsonb WHERE run_id=$1', [run,JSON.stringify(summary(b))]); });
      validate(bundle, key);
      await client.query('BEGIN');
      for (const endpoint of ordered) {
        const p = bundle[endpoint];
        await client.query('INSERT INTO f1_ingest.staged_payloads(run_id,endpoint,request_url,retrieved_at,raw_response) VALUES($1,$2,$3,$4,$5)', [run,endpoint,p.url,p.retrievedAt,p.raw]);
      }
      await client.query('SELECT f1_ingest.publish($1)', [run]);
      const result = (await client.query('SELECT run_id,status,data_version,endpoint_summary,changes FROM f1_ingest.ingestion_runs WHERE run_id=$1', [run])).rows[0];
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      await client.query('SELECT f1_ingest.fail_run($1,$2)', [run,safeError(error)]);
      throw error;
    }
  } finally { await client.query('SELECT pg_advisory_unlock(713004,$1)', [key]); }
}
export function fixtureBundle(rows: Record<Endpoint, Row[]>): Bundle {
  return Object.fromEntries(ordered.map(endpoint => [endpoint, {
    url: `https://api.openf1.org/v1/${endpoint}?session_key=9644`, raw: JSON.stringify(rows[endpoint]), rows: rows[endpoint],
    retrievedAt: new Date().toISOString(), attempts: 1, bytes: Buffer.byteLength(JSON.stringify(rows[endpoint])),
  }])) as Bundle;
}
