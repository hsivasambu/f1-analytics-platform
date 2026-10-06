import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { Client } from 'pg';
import { configuration, connection, environment, safeError } from './shared';

export async function migrate(client: Client) {
  const directory = resolve('sql/migrations');
  const files = (await readdir(directory)).filter(file => /^\d{3}_[a-z_]+\.sql$/.test(file)).sort();
  const applied: string[] = [];
  await client.query('SELECT pg_advisory_lock(713003)');
  try {
    await client.query('BEGIN');
    await client.query('CREATE SCHEMA IF NOT EXISTS f1_meta');
    await client.query(`CREATE TABLE IF NOT EXISTS f1_meta.schema_migrations (
      version text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
    await client.query('REVOKE ALL ON SCHEMA f1_meta FROM PUBLIC');
    await client.query('COMMIT');
    const existing = await client.query('SELECT version, sha256 FROM f1_meta.schema_migrations');
    if (existing.rows.some(row => !files.includes(row.version))) throw new Error('Database contains a migration missing from this checkout');
    for (const file of files) {
      const sql = await readFile(join(directory, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previous = existing.rows.find(row => row.version === file);
      if (previous) {
        if (previous.sha256 !== checksum) throw new Error(`Applied migration changed: ${file}; restore it and create a new version`);
        console.log(`Already applied: ${file}`);
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO f1_meta.schema_migrations (version, sha256) VALUES ($1, $2)', [file, checksum]);
        await client.query('COMMIT');
        applied.push(file);
        console.log(`Applied: ${file}`);
      } catch (error) { await client.query('ROLLBACK'); throw error; }
    }
    return applied;
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.query('SELECT pg_advisory_unlock(713003)').catch(() => undefined);
  }
}

async function main() {
  const env = environment(process.argv.slice(2));
  const config = await configuration(env);
  const client = connection(config.values.MIGRATION_DATABASE_URL);
  try { await client.connect(); await migrate(client); console.log(`Migrations complete: ${env}`); }
  finally { await client.end(); }
}
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/migrate.ts')) {
  main().catch(error => { console.error(safeError(error)); process.exitCode = 1; });
}
