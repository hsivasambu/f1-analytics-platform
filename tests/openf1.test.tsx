import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completedSessions, createClient, keyCheck, profile, retryDelay } from '../scripts/openf1/core';

const quick = { intervalMs: 0, sleep: async () => undefined };
test('429 respects Retry-After then succeeds; query operators are encoded', async () => {
  let calls = 0;
  const waits: number[] = [];
  const get = createClient({ ...quick, sleep: async ms => { waits.push(ms); }, fetch: async input => {
    assert.equal(decodeURIComponent(new URL(String(input)).search), '?session_key=123&lap_number<=5');
    calls++;
    return calls === 1 ? new Response('', { status: 429, headers: { 'Retry-After': '2' } }) : Response.json([{ lap_number: 1 }]);
  } });
  const result = await get('laps', { session_key: 123, 'lap_number<=': 5 });
  assert.equal(result.attempts, 2);
  assert.ok(waits.includes(2000));
});
test('temporary failures stop after three attempts', async () => {
  let calls = 0;
  const get = createClient({ ...quick, fetch: async () => { calls++; return new Response('', { status: 503 }); } });
  await assert.rejects(get('drivers', { session_key: 123 }), /HTTP 503.*attempt 3\/3/);
  assert.equal(calls, 3);
});
test('access errors and invalid payloads do not retry', async () => {
  for (const response of [new Response('', { status: 403 }), Response.json({ error: 'not an array' })]) {
    let calls = 0;
    const get = createClient({ ...quick, fetch: async () => { calls++; return response; } });
    await assert.rejects(get('drivers', { session_key: 123 }));
    assert.equal(calls, 1);
  }
});
test('timeout aborts requests and retry count is bounded', async () => {
  let calls = 0;
  const get = createClient({ ...quick, timeoutMs: 5, fetch: async (_input, init) => {
    calls++;
    return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('timed out', 'AbortError'))));
  } });
  await assert.rejects(get('laps', { session_key: 123 }), /timed out.*attempt 3\/3/);
  assert.equal(calls, 3);
});
test('response byte and row bounds stop oversized downloads', async () => {
  await assert.rejects(createClient({ ...quick, maxBytes: 2, fetch: async () => Response.json([{ x: 1 }]) })('laps', {}), /safety bound/);
  await assert.rejects(createClient({ ...quick, maxRows: 1, fetch: async () => Response.json([{}, {}]) })('laps', {}), /row safety bound/);
});
test('Retry-After is bounded and supports HTTP dates', () => {
  assert.throws(() => retryDelay('31', 0), /retry budget/);
  assert.equal(retryDelay('Thu, 01 Jan 1970 00:00:02 GMT', 0, 0), 2000);
});
test('profiling distinguishes absent, null, zero, false and empty arrays', () => {
  const result = profile([{ value: 0 }, { value: null }, {}, { value: false }, { value: [] }]);
  assert.equal(result.fields.value.absent, 1);
  assert.equal(result.fields.value.nulls, 1);
  assert.equal(result.fields.value.zeros, 1);
  assert.deepEqual(result.fields.value.types, ['array', 'boolean', 'null', 'number']);
});
test('candidate key checks expose missing values and duplicate laps', () => {
  assert.deepEqual(keyCheck([{ session: 1, lap: 2 }, { session: 1, lap: 2 }, { session: 1, lap: null }], ['session', 'lap']),
    { fields: ['session', 'lap'], missing: 1, duplicates: 1 });
});
test('discovery excludes future, cancelled and non-race sessions', () => {
  const rows = [
    { session_key: 1, session_name: 'Race', date_end: '2024-01-01', date_start: '2024-01-01' },
    { session_key: 2, session_name: 'Race', date_end: '2030-01-01' },
    { session_key: 3, session_name: 'Sprint', date_end: '2024-01-01' },
    { session_key: 4, session_name: 'Race', date_end: '2024-01-01', is_cancelled: true },
  ];
  assert.deepEqual(completedSessions(rows, Date.parse('2025-01-01')).map(row => row.session_key), [1]);
});
