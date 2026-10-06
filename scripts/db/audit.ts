import assert from 'node:assert/strict';
import { TLSSocket } from 'node:tls';
import { configuration, connection, environment, safeError } from './shared';

// Read-only audit is safe for either environment; fixtures remain development-only.
async function main() {
  const env = environment(process.argv.slice(2));
  const { values } = await configuration(env);
  assert.ok(values.MIGRATION_DATABASE_URL, 'MIGRATION_DATABASE_URL is missing');
  const ownerUrl = new URL(values.MIGRATION_DATABASE_URL);
  for (const [variable, expectedRole] of [
    ['MIGRATION_DATABASE_URL', ownerUrl.username],
    ['APP_DATABASE_URL', 'f1_app_login'],
    ['INGESTION_DATABASE_URL', 'f1_ingest_login'],
  ]) {
    const raw = values[variable];
    assert.ok(raw, `${variable} is missing`);
    const url = new URL(raw);
    assert.equal(url.hostname, ownerUrl.hostname, `${variable} endpoint mismatch`);
    assert.equal(url.pathname, ownerUrl.pathname, `${variable} database mismatch`);
    assert.equal(url.username, expectedRole, `${variable} role mismatch`);
    const client = connection(values[variable]);
    try {
      await client.connect();
      await client.query('BEGIN READ ONLY');
      // Check the actual client transport: pg_stat_ssl describes the backend
      // connection behind Neon's proxy, rather than our public TLS connection.
      if (ownerUrl.hostname.endsWith('.neon.tech')) {
        const socket = client.connection.stream;
        assert.ok(socket instanceof TLSSocket, 'Expected a TLS client socket');
        assert.equal(socket.encrypted, true);
        assert.equal(socket.authorized, true, 'Expected a verified server certificate');
      }
      const role = (await client.query(`SELECT current_user AS name, rolsuper, rolcreatedb,
        rolcreaterole, rolreplication, rolbypassrls FROM pg_roles WHERE rolname = current_user`)).rows[0];
      assert.equal(role.name, decodeURIComponent(expectedRole));
      const count = (await client.query('SELECT count(*)::integer AS rows FROM f1.sessions')).rows[0].rows;
      if (variable === 'MIGRATION_DATABASE_URL') {
        const versions = await client.query('SELECT version FROM f1_meta.schema_migrations ORDER BY version');
        assert.equal(versions.rowCount, 4);
        console.log(`PASS: ${env} migration ledger has four versions; sessions=${count}`);
      } else {
        for (const flag of ['rolsuper', 'rolcreatedb', 'rolcreaterole', 'rolreplication', 'rolbypassrls']) assert.equal(role[flag], false);
        const acl = (await client.query(`SELECT
          has_table_privilege(current_user, 'f1.laps', 'SELECT') AS read,
          has_table_privilege(current_user, 'f1.laps', 'INSERT') AS insert,
          has_table_privilege(current_user, 'f1.laps', 'DELETE') AS delete,
          has_schema_privilege(current_user, 'f1', 'CREATE') AS ddl,
          CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'neon_superuser')
            THEN pg_has_role(current_user, 'neon_superuser', 'MEMBER') ELSE false END AS neon_admin`)).rows[0];
        assert.equal(acl.read, true);
        assert.equal(acl.insert, variable === 'INGESTION_DATABASE_URL');
        assert.equal(acl.delete, false);
        assert.equal(acl.ddl, false);
        assert.equal(acl.neon_admin, false);
      }
      console.log(`PASS: ${env} ${variable} connects with expected identity and TLS/privileges`);
      await client.query('ROLLBACK');
    } finally { await client.end(); }
  }
}
main().catch(error => { console.error(safeError(error)); process.exitCode = 1; });
