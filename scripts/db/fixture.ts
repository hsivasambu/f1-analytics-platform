import { readFile } from 'node:fs/promises';
import { configuration, connection, environment, safeError } from './shared';
async function main() {
  const env = environment(process.argv.slice(2));
  if (env !== 'development') throw new Error('Fixtures are development-only');
  const config = await configuration(env);
  const client = connection(config.values.MIGRATION_DATABASE_URL);
  let connected = false;
  try {
    await client.connect(); connected = true;
    await client.query('BEGIN');
    await client.query(await readFile('sql/fixtures/tiny.sql', 'utf8'));
    const result = await client.query(await readFile('sql/examples/fixture_join.sql', 'utf8'));
    console.table(result.rows);
    await client.query('ROLLBACK');
    console.log('Synthetic fixture queried successfully; transaction rolled back. No race rows retained.');
  } catch (error) { if (connected) await client.query('ROLLBACK').catch(() => undefined); throw error; }
  finally { await client.end(); }
}
main().catch(error => { console.error(safeError(error)); process.exitCode = 1; });
