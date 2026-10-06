import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
import pg from 'pg';

export type Environment = 'development' | 'production';
export function environment(args: string[]): Environment {
  if (args.length === 0) return 'development';
  if (args.length !== 2 || args[0] !== '--env' || !['development', 'production'].includes(args[1])) {
    throw new Error('Use --env development or --env production');
  }
  return args[1] as Environment;
}
export async function configuration(env: Environment) {
  const filename = resolve(`.env.${env}.local`);
  let text: string;
  try { text = await readFile(filename, 'utf8'); }
  catch { throw new Error(`Create .env.${env}.local from .env.example and add the direct migration URL locally. Do not send secrets in chat.`); }
  const values = parseEnv(text);
  if (values.DATABASE_ENV !== env) throw new Error(`DATABASE_ENV must be ${env} in that file`);
  return { filename, text, values };
}
export function connection(raw: string | undefined) {
  if (!raw) throw new Error('Required database URL is missing from the local environment file');
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Expected a PostgreSQL URL');
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
  if (!local) url.searchParams.set('sslmode', 'verify-full');
  if (url.hostname.includes('-pooler.')) throw new Error('Use a direct endpoint for migration/provisioning/check commands');
  return new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 15_000,
    statement_timeout: 30_000, query_timeout: 35_000, enableChannelBinding: !local });
}
export async function saveVariables(filename: string, text: string, variables: Record<string, string>) {
  for (const [key, value] of Object.entries(variables)) {
    const line = `${key}=${value}`;
    const regex = new RegExp(`^${key}=.*$`, 'm');
    text = regex.test(text) ? text.replace(regex, () => line) : `${text.trimEnd()}\n${line}\n`;
  }
  await writeFile(filename, text, { mode: 0o600 });
}
export function safeError(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  const message = error instanceof Error ? error.message : 'Unknown database error';
  return `${code ? `[${code}] ` : ''}${message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]')}`;
}
