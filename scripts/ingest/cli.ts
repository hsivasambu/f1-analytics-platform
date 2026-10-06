import { configuration, connection, environment, safeError } from '../db/shared';
import { createClient } from '../openf1/core';
import { ingest, ordered, type Bundle } from './pipeline';
async function main() {
  const [input, ...flags] = process.argv.slice(2);
  if (!/^\d+$/.test(input ?? '') || Number(input) !== 9644) throw new Error('Usage: npm run data:ingest -- 9644 [--env development|production]; Stage 4 allows session 9644 only');
  const env = environment(flags);
  const { values } = await configuration(env);
  const client = connection(values.INGESTION_DATABASE_URL);
  const get = createClient({ intervalMs: 2100 });
  try {
    await client.connect();
    const result = await ingest(client, Number(input), async progress => {
      const bundle: Partial<Bundle> = {};
      for (const endpoint of ordered) {
        bundle[endpoint] = await get(endpoint, { session_key: Number(input) });
        console.log(`${endpoint}: ${bundle[endpoint]!.rows.length} rows`);
        await progress(bundle);
      }
      return bundle as Bundle;
    });
    console.log(JSON.stringify(result, null, 2));
  } finally { await client.end(); }
}
main().catch(error => { console.error(safeError(error)); process.exitCode = 1; });
