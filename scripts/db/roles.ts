import { randomBytes } from 'node:crypto';
import { configuration, connection, environment, safeError, saveVariables } from './shared';

async function main() {
  const env = environment(process.argv.slice(2));
  const config = await configuration(env);
  const migrationUrl = config.values.MIGRATION_DATABASE_URL;
  if (!migrationUrl) throw new Error('MIGRATION_DATABASE_URL is missing');
  const client = connection(migrationUrl);
  const names = [['f1_app_login', 'f1_app_reader', 'APP_DATABASE_URL'], ['f1_ingest_login', 'f1_ingestor', 'INGESTION_DATABASE_URL']];
  const variables: Record<string, string> = {};
  let connected = false;
  try {
    await client.connect(); connected = true;
    await client.query('BEGIN');
    for (const [login, group, variable] of names) {
      const found = await client.query('SELECT rolname FROM pg_roles WHERE rolname = $1', [login]);
      if (found.rowCount) {
        if (!config.values[variable] || new URL(config.values[variable]).username !== login) {
          throw new Error(`${login} exists but its local URL is missing; recover its existing URL locally. No password is reset automatically.`);
        }
        console.log(`Existing role retained: ${login}`);
        continue;
      }
      const password = randomBytes(32).toString('hex');
      // Names are fixed and password is generated hex, never user-supplied SQL.
      await client.query(`CREATE ROLE ${login} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);
      await client.query(`GRANT ${group} TO ${login}`);
      const url = new URL(migrationUrl);
      url.username = login;
      url.password = password;
      url.searchParams.set('sslmode', ['localhost', '127.0.0.1'].includes(url.hostname) ? 'disable' : 'verify-full');
      variables[variable] = url.toString();
      console.log(`Created restricted role: ${login}`);
    }
    // Save locally before committing roles; a disk error rolls the transaction back.
    await saveVariables(config.filename, config.text, variables);
    await client.query('COMMIT');
    console.log(`Credential URLs saved only in .env.${env}.local; no secrets printed.`);
  } catch (error) { if (connected) await client.query('ROLLBACK').catch(() => undefined); throw error; }
  finally { await client.end(); }
}
main().catch(error => { console.error(safeError(error)); process.exitCode = 1; });
