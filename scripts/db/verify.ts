import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { Client } from 'pg';
import { migrate } from './migrate';
import { configuration, connection, environment, safeError } from './shared';

async function rejected(client: Client, sql: string, code: string) {
  await client.query('SAVEPOINT reject_check');
  let observed: string | undefined;
  try { await client.query(sql); }
  catch (error) { observed = (error as { code?: string }).code; }
  await client.query('ROLLBACK TO SAVEPOINT reject_check');
  await client.query('RELEASE SAVEPOINT reject_check');
  assert.equal(observed, code, `Expected SQLSTATE ${code} for ${sql.slice(0, 70)}`);
}
async function main() {
  const env = environment(process.argv.slice(2));
  if (env !== 'development') throw new Error('Verification fixtures are development-only');
  const config = await configuration(env);
  const owner = connection(config.values.MIGRATION_DATABASE_URL);
  const reader = connection(config.values.APP_DATABASE_URL);
  const writer = connection(config.values.INGESTION_DATABASE_URL);
  const connected = new Set<Client>();
  try {
    await owner.connect(); connected.add(owner);
    assert.deepEqual(await migrate(owner), [], 'Run db:migrate first; rerun must apply zero migrations');
    const baseline = await owner.query('SELECT count(*)::integer AS n FROM f1.sessions');
    await owner.query('BEGIN');
    await owner.query(await readFile('sql/fixtures/tiny.sql', 'utf8'));
    const joined = await owner.query(await readFile('sql/examples/fixture_join.sql', 'utf8'));
    assert.equal(joined.rowCount, 3);
    const aggregate = await owner.query(`SELECT count(*)::int AS rows, count(lap_duration)::int AS known,
      avg(lap_duration)::text AS average FROM f1.laps WHERE session_key IN (900000001,900000002)`);
    assert.equal(aggregate.rows[0].rows, 3);
    assert.equal(aggregate.rows[0].known, 2);
    assert.ok(aggregate.rows[0].average.startsWith('90.8125'));
    console.log(`SQL exercise result: ${aggregate.rows[0].rows} laps, ${aggregate.rows[0].known} known durations, AVG=${aggregate.rows[0].average} seconds (synthetic)`);
    assert.equal(joined.rows[0].lap_duration, '90.125');
    assert.equal(joined.rows[1].lap_duration, null);
    assert.equal(joined.rows[2].full_name, 'Different Fixture Driver');
    const wrong = await owner.query(`SELECT count(*)::int AS n FROM f1.laps l JOIN f1.session_entries e USING(driver_number)
      WHERE l.session_key IN (900000001, 900000002) AND e.session_key IN (900000001, 900000002)`);
    assert.equal(wrong.rows[0].n, 6, 'Driver number alone multiplies unrelated session rows');
    const stamp = await owner.query(`SELECT l.date_start = timestamptz '2024-01-01T12:00:00Z' AS same_instant,
      r.raw_record->>'date_start' AS original FROM f1.laps l JOIN f1_ingest.source_records r ON r.record_id=l.source_record_id
      WHERE l.session_key=900000001 AND l.lap_number=1`);
    assert.equal(stamp.rows[0].same_instant, true);
    assert.equal(stamp.rows[0].original, '2024-01-01T13:00:00+01:00');
    const pits = await owner.query('SELECT count(*)::int AS n, count(DISTINCT content_sha256)::int AS hashes FROM f1.pit_events WHERE session_key=900000001');
    assert.deepEqual(pits.rows[0], { n: 3, hashes: 2 });
    const controls = await owner.query('SELECT count(*)::int AS n FROM f1.race_control_events WHERE session_key=900000001');
    assert.equal(controls.rows[0].n, 2, 'Same timestamp/category/message with distinct scopes stays distinct');
    await rejected(owner, 'UPDATE f1.session_entries SET driver_id=gen_random_uuid() WHERE session_key=900000001', '23503');
    await rejected(owner, 'INSERT INTO f1.laps SELECT * FROM f1.laps WHERE session_key=900000001 AND lap_number=1', '23505');
    await rejected(owner, 'UPDATE f1.laps SET driver_number=77 WHERE session_key=900000001 AND lap_number=1', '23514');
    await rejected(owner, 'UPDATE f1.laps SET lap_duration=-1 WHERE session_key=900000001 AND lap_number=1', '23514');
    await rejected(owner, "UPDATE f1.laps SET lap_duration='NaN'::numeric WHERE session_key=900000001 AND lap_number=1", '23514');
    await rejected(owner, 'INSERT INTO f1.pit_events (session_key, driver_number, lap_number, source_record_id) SELECT session_key, driver_number, lap_number, source_record_id FROM f1.pit_events WHERE session_key=900000001 LIMIT 1', '23505');
    await rejected(owner, "UPDATE f1_ingest.source_records SET raw_record='{}'::jsonb", '23514');
    await rejected(owner, 'UPDATE f1.laps SET source_record_id=(SELECT source_record_id FROM f1.sessions WHERE session_key=900000001) WHERE session_key=900000001 AND lap_number=1', '23514');
    await rejected(owner, `INSERT INTO f1_ingest.source_records (payload_id, source_ordinal, raw_record)
      SELECT payload_id, 99, '{}'::jsonb FROM f1_ingest.source_payloads LIMIT 1`, '23514');
    // Replay the same full event response into a new run; all source observations survive,
    // but repeated event keys must be rejected rather than creating extra canonical events.
    await owner.query(`WITH run AS (
      INSERT INTO f1_ingest.ingestion_runs(source,purpose) VALUES ('fixture','Replay check') RETURNING run_id
    ), packet AS (
      INSERT INTO f1_ingest.source_payloads(run_id,endpoint,request_url,retrieved_at,raw_response)
      SELECT run.run_id, p.endpoint, p.request_url, now(), p.raw_response FROM run CROSS JOIN f1_ingest.source_payloads p
      WHERE p.endpoint='pit' AND p.run_id=(SELECT run_id FROM f1_ingest.ingestion_runs WHERE purpose='Stage 3 synthetic transactional fixture')
      RETURNING payload_id, raw_response
    ) INSERT INTO f1_ingest.source_records(payload_id,source_ordinal,raw_record)
      SELECT payload_id, (position-1)::int, value FROM packet CROSS JOIN LATERAL jsonb_array_elements(raw_response::jsonb) WITH ORDINALITY r(value,position)`);
    await rejected(owner, `INSERT INTO f1.pit_events(session_key, driver_number, lap_number, source_record_id)
      SELECT 900000001, (raw_record->>'driver_number')::int, (raw_record->>'lap_number')::int, record_id FROM f1_ingest.source_records r JOIN f1_ingest.source_payloads p USING(payload_id)
      JOIN f1_ingest.ingestion_runs n USING(run_id) WHERE n.purpose='Replay check' LIMIT 1`, '23505');
    await owner.query('ROLLBACK');
    assert.equal((await owner.query('SELECT count(*)::integer AS n FROM f1.sessions')).rows[0].n, baseline.rows[0].n);
    console.log('PASS: fixture joins, timezone preservation, nulls, keys/FKs, constraints, event multiplicity/replay, provenance and rollback');
    for (const [client, label] of [[reader, 'application'], [writer, 'ingestion']] as const) {
      await client.connect(); connected.add(client);
      const role = await client.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user');
      assert.ok(Object.values(role.rows[0]).every(value => value === false));
      const neon = await client.query("SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='neon_superuser' AND pg_has_role(current_user,oid,'MEMBER')) AS broad");
      assert.equal(neon.rows[0].broad, false);
      await client.query('BEGIN');
      await client.query('SELECT session_key FROM f1.sessions LIMIT 1');
      await rejected(client, 'CREATE TABLE f1.denied_probe(id int)', '42501');
      await rejected(client, 'CREATE TABLE public.denied_probe(id int)', '42501');
      await rejected(client, 'CREATE TEMP TABLE denied_probe(id int)', '42501');
      if (label === 'application') {
        for (const statement of ['INSERT INTO f1.sessions(session_key) VALUES(900000003)', 'UPDATE f1.sessions SET session_name=session_name', 'DELETE FROM f1.sessions', 'TRUNCATE f1.sessions', 'SELECT * FROM f1_ingest.source_payloads', 'SELECT * FROM f1_meta.schema_migrations']) {
          await rejected(client, statement, '42501');
        }
        // default_transaction_read_only is deliberately not used: actual grants enforce denial.
      } else {
        await client.query("INSERT INTO f1_ingest.ingestion_runs(source,purpose) VALUES('fixture','Writer access verification')");
        await rejected(client, 'DELETE FROM f1.sessions', '42501');
        await rejected(client, "UPDATE f1_ingest.source_payloads SET request_url='changed'", '42501');
      }
      await client.query('ROLLBACK');
      console.log(`PASS: real ${label} login has intended privileges and no admin/DDL/temp access`);
    }
    console.log('Development database verification complete; all fixtures rolled back.');
  } finally {
    for (const client of [owner, reader, writer]) { if (connected.has(client)) await client.query('ROLLBACK').catch(() => undefined); await client.end(); }
  }
}
main().catch(error => { console.error(safeError(error)); process.exitCode = 1; });
