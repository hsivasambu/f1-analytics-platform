import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { completedSessions, createClient, endpoints, keyCheck, profile, type Endpoint, type Row } from './core';

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] ?? 'investigate';
  if (!['discover', 'investigate'].includes(mode) || args.length > 2) throw new Error('Usage: npm run data:discover -- 2024 OR npm run data:investigate -- 2024');
  const year = Number(args[1] ?? 2024);
  if (![2023, 2024, 2025].includes(year)) throw new Error('Choose historical year 2023, 2024 or 2025; no live sessions are supported.');
  const directory = resolve('data/raw/openf1', `${year}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  await mkdir(directory, { recursive: true });
  const get = createClient();
  const manifest: unknown[] = [];
  let requests = 0;
  async function download(label: string, endpoint: Endpoint, params: Record<string, number | string>) {
    if (++requests > 24) throw new Error('Investigation exceeded its 24-query budget');
    const result = await get(endpoint, params);
    const filename = `${label}.json`;
    await writeFile(join(directory, filename), result.raw);
    manifest.push({ filename, endpoint, params, url: result.url, retrievedAt: result.retrievedAt,
      sha256: createHash('sha256').update(result.raw).digest('hex'), bytes: result.bytes,
      rows: result.rows.length, attempts: result.attempts });
    await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(`${label}: ${result.rows.length} rows`);
    return result.rows;
  }
  const discovered = await download('discovery-sessions', 'sessions', { year, session_name: 'Race' });
  const sessions = completedSessions(discovered);
  console.table(sessions.map(row => ({ session_key: row.session_key, circuit: row.circuit_short_name, date: row.date_start })));
  if (mode === 'discover') { console.log(`Raw discovery: ${directory}`); return; }
  if (sessions.length < 3) throw new Error('Fewer than three completed sessions discovered; no race selected.');
  // Fixed, small coverage investigation: latest three completed races, not a season download.
  const candidates: { session: Row; data: Partial<Record<Endpoint, Row[]>>; errors: string[] }[] = [];
  for (const session of sessions.slice(-3)) {
    const data: Partial<Record<Endpoint, Row[]>> = {};
    const errors: string[] = [];
    for (const endpoint of endpoints) {
      const params: Record<string, number | string> = { session_key: Number(session.session_key) };
      if (endpoint === 'laps') params['lap_number<='] = 5;
      try { data[endpoint] = await download(`coverage-${session.session_key}-${endpoint}`, endpoint, params); }
      catch (error) { errors.push(`${endpoint}: ${error instanceof Error ? error.message : String(error)}`); }
    }
    candidates.push({ session, data, errors });
  }
  const coverage = candidates.map(({ session, data, errors }) => ({
    session_key: session.session_key, circuit: session.circuit_short_name, date: session.date_start,
    rows: Object.fromEntries(endpoints.map(endpoint => [endpoint, data[endpoint]?.length ?? null])),
    errors, accessibleAndNonempty: errors.length === 0 && endpoints.every(endpoint => (data[endpoint]?.length ?? 0) > 0),
  }));
  await writeFile(join(directory, 'coverage.json'), JSON.stringify(coverage, null, 2));
  const selected = candidates.find(candidate => candidate.errors.length === 0 &&
    endpoints.every(endpoint => (candidate.data[endpoint]?.length ?? 0) > 0));
  if (!selected) throw new Error(`No candidate passed all five endpoint access/nonempty checks. Inspect ${directory}/coverage.json; no race selected.`);
  const sessionKey = Number(selected.session.session_key);
  const data = { ...selected.data };
  data.sessions = await download(`sample-${sessionKey}-sessions`, 'sessions', { session_key: sessionKey });
  const drivers = [...(data.drivers ?? [])].filter(row => typeof row.driver_number === 'number')
    .sort((a, b) => Number(a.driver_number) - Number(b.driver_number)).slice(0, 2);
  if (drivers.length < 2) throw new Error('Selected session has fewer than two identified drivers.');
  data.laps = [];
  for (const driver of drivers) {
    data.laps.push(...await download(`sample-${sessionKey}-laps-driver-${driver.driver_number}`, 'laps', {
      session_key: sessionKey, driver_number: Number(driver.driver_number), 'lap_number<=': 100,
    }));
  }
  const profiles = Object.fromEntries(Object.entries(data).map(([endpoint, rows]) => [endpoint, profile(rows)]));
  const keys = {
    laps: keyCheck(data.laps, ['session_key', 'driver_number', 'lap_number']),
    drivers: keyCheck(data.drivers ?? [], ['session_key', 'driver_number']),
    stints: keyCheck(data.stints ?? [], ['session_key', 'driver_number', 'stint_number']),
    pit: keyCheck(data.pit ?? [], ['session_key', 'driver_number', 'date']),
    race_control: keyCheck(data.race_control ?? [], ['session_key', 'date', 'category', 'message']),
  };
  const frequency = (rows: Row[], field: string) => Object.fromEntries([...new Set(rows.map(row => String(row[field])))].sort()
    .map(value => [value, rows.filter(row => String(row[field]) === value).length]));
  const driverKeys = new Set((data.drivers ?? []).map(row => `${row.session_key}/${row.driver_number}`));
  const joins = {
    lapDriverOrphans: data.laps.filter(row => !driverKeys.has(`${row.session_key}/${row.driver_number}`)).length,
    lapStintMatches: frequency(data.laps.map(lap => ({ count: (data.stints ?? []).filter(stint =>
      stint.session_key === lap.session_key && stint.driver_number === lap.driver_number &&
      typeof stint.lap_start === 'number' && typeof stint.lap_end === 'number' &&
      typeof lap.lap_number === 'number' && stint.lap_start <= lap.lap_number && stint.lap_end >= lap.lap_number).length })), 'count'),
  };
  const dates = (data.race_control ?? []).map(row => row.date).filter((date): date is string => typeof date === 'string').sort();
  const observations = {
    raceControlCategories: frequency(data.race_control ?? [], 'category'),
    raceControlScopes: frequency(data.race_control ?? [], 'scope'),
    raceControlDateRange: [dates[0] ?? null, dates.at(-1) ?? null],
    raceControlInvalidDates: dates.filter(date => !Number.isFinite(Date.parse(date))).length,
    pitLaneAliasMismatches: (data.pit ?? []).filter(row => typeof row.lane_duration === 'number' &&
      typeof row.pit_duration === 'number' && row.lane_duration !== row.pit_duration).length,
  };
  const report = { generatedAt: new Date().toISOString(), sourceDocumentation: 'https://openf1.org/docs/',
    selectedSession: selected.session, sampledDrivers: drivers.map(row => row.driver_number),
    scope: 'Two drivers, at most 100 laps each. Coverage probes use laps 1–5 for all drivers. Low-volume drivers/stints/pit/race_control are whole-session responses, not guaranteed complete source coverage.',
    requests, coverage, profiles, candidateKeys: keys, joins, observations };
  await writeFile(join(directory, 'profile.json'), JSON.stringify(report, null, 2));
  const lines = ['# OpenF1 investigation profile', '', `Generated: ${report.generatedAt}`, '',
    `Selected: ${selected.session.circuit_short_name}, session ${sessionKey}; drivers ${report.sampledDrivers.join(', ')}.`, '', report.scope, '',
    '## Candidate access and coverage', '', '| Session | Circuit | drivers | laps 1–5 | stints | pit | race_control | Passed |', '|---|---|---:|---:|---:|---:|---:|---|',
    ...coverage.map(row => `| ${row.session_key} | ${row.circuit} | ${row.rows.drivers} | ${row.rows.laps} | ${row.rows.stints} | ${row.rows.pit} | ${row.rows.race_control} | ${row.accessibleAndNonempty} |`),
    '', 'Nonempty endpoint responses establish access and observed coverage, not completeness.', ''];
  for (const [endpoint, result] of Object.entries(profiles)) {
    lines.push(`## ${endpoint}: ${result.rowCount} rows`, '', '| Field | Observed types | Absent | Null | Zero | Examples |', '|---|---|---:|---:|---:|---|');
    for (const [field, stats] of Object.entries(result.fields)) {
      lines.push(`| ${field} | ${stats.types.join(', ')} | ${stats.absent} | ${stats.nulls} | ${stats.zeros} | ${stats.examples.map(value => value.replaceAll('|', '\\|')).join('; ')} |`);
    }
    lines.push('');
  }
  lines.push('## Candidate keys and join checks', '', '```json', JSON.stringify({ keys, joins, observations }, null, 2), '```', '',
    'Lap grain: one driver’s numbered lap within one session. Candidate key: session_key + driver_number + lap_number; uniqueness here is a sample observation.',
    'Join laps to drivers on session_key + driver_number; to stints on those keys plus inclusive lap_start/lap_end. Pit lap_number is an event association, not an automatic exclusion rule.',
    'Race-control date is a UTC message timestamp. Preserve category, scope and nullable driver/lap/sector fields; one timestamp can have multiple messages. Do not assume every message targets every driver.', '',
    '## Semantics and limits', '', '[Official documentation](https://openf1.org/docs/): lane_duration is pit-lane time in seconds; deprecated pit_duration is its alias. stop_duration is stationary stop time, documented from the 2024 US GP onward. Missing is not zero.',
    'Lap date_start is approximate. Recorded lap times do not establish fuel load, traffic effect, driver intent, tyre degradation causality or counterfactual outcomes. Do not fill missing values silently.',
    'Raw payloads and URL/retrieval-time/SHA-256 provenance are retained in the run directory. Re-running creates a new run rather than overwriting evidence.');
  await writeFile(join(directory, 'profile.md'), lines.join('\n') + '\n');
  console.log(`Selected session ${sessionKey} after coverage checks. ${requests} queries.`);
  console.log(`Profile and untouched raw JSON: ${directory}`);
}
main().catch(error => { console.error(`OpenF1 investigation failed: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; });
