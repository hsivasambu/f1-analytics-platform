import { setTimeout as delay } from 'node:timers/promises';

export type Row = Record<string, unknown>;
export type Endpoint = 'sessions' | 'drivers' | 'laps' | 'stints' | 'pit' | 'race_control';
export const endpoints: Endpoint[] = ['drivers', 'laps', 'stints', 'pit', 'race_control'];
const BASE = 'https://api.openf1.org/v1/';

export class HttpError extends Error {
  constructor(public status: number, public retryAfter: string | null) { super(`HTTP ${status}`); }
}
export function retryDelay(value: string | null, attempt: number, now = Date.now()) {
  const seconds = value === null ? NaN : Number(value);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : value ? Date.parse(value) - now : NaN;
  if (Number.isFinite(ms) && ms > 30_000) throw new Error('Retry-After exceeds the 30s retry budget; try again later.');
  return Number.isFinite(ms) ? Math.max(0, ms) : Math.min(1000 * 2 ** attempt, 8000);
}

export function createClient(options: {
  fetch?: typeof fetch; sleep?: (ms: number) => Promise<unknown>; timeoutMs?: number;
  maxAttempts?: number; intervalMs?: number; maxBytes?: number; maxRows?: number;
} = {}) {
  const fetcher = options.fetch ?? fetch;
  const sleep = options.sleep ?? delay;
  let lastRequest = 0;
  return async (endpoint: Endpoint, params: Record<string, string | number>) => {
    const url = new URL(endpoint, BASE);
    // OpenF1 comparison syntax is `field<=value`, not the conventional
    // query key `field<=` followed by another equals sign.
    url.search = Object.entries(params).map(([key, value]) => {
      const match = key.match(/^(.*?)(<=|>=|<|>)$/);
      return match ? `${encodeURIComponent(match[1])}${match[2]}${encodeURIComponent(String(value))}`
        : `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
    }).join('&');
    const attempts = options.maxAttempts ?? 3;
    for (let attempt = 0; attempt < attempts; attempt++) {
      await sleep(Math.max(0, (options.intervalMs ?? 1100) - (Date.now() - lastRequest)));
      lastRequest = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
      try {
        const response = await fetcher(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
        if (!response.ok) {
          await response.body?.cancel();
          throw new HttpError(response.status, response.headers.get('retry-after'));
        }
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Empty response body');
        const chunks: Uint8Array[] = [];
        let bytes = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > (options.maxBytes ?? 2_000_000)) {
            await reader.cancel();
            throw new Error('Response exceeds the 2 MB safety bound; narrow the query.');
          }
          chunks.push(value);
        }
        const raw = Buffer.concat(chunks).toString('utf8');
        const data: unknown = JSON.parse(raw);
        if (!Array.isArray(data) || data.some(row => row === null || typeof row !== 'object' || Array.isArray(row))) {
          throw new Error('Expected an array of JSON objects');
        }
        if (data.length > (options.maxRows ?? 2000)) throw new Error('Response exceeds row safety bound; narrow the query.');
        return { url: url.toString(), raw, rows: data as Row[], retrievedAt: new Date().toISOString(), attempts: attempt + 1, bytes };
      } catch (error) {
        const retryable = error instanceof HttpError ? error.status === 429 || [500, 502, 503, 504].includes(error.status)
          : error instanceof TypeError || (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name));
        if (!retryable || attempt === attempts - 1) {
          throw new Error(`${url}: ${error instanceof Error ? error.message : String(error)} (attempt ${attempt + 1}/${attempts})`);
        }
        const wait = retryDelay(error instanceof HttpError ? error.retryAfter : null, attempt);
        console.error(`Retry ${attempt + 2}/${attempts} for ${endpoint} after ${wait}ms`);
        await sleep(wait);
      } finally { clearTimeout(timeout); }
    }
    throw new Error('Unreachable request state');
  };
}

export function profile(rows: Row[]) {
  const fields = [...new Set(rows.flatMap(Object.keys))].sort();
  return {
    rowCount: rows.length,
    fields: Object.fromEntries(fields.map(field => {
      const present = rows.filter(row => Object.hasOwn(row, field));
      const values = present.map(row => row[field]);
      return [field, {
        types: [...new Set(values.map(value => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value))].sort(),
        absent: rows.length - present.length,
        nulls: values.filter(value => value === null).length,
        zeros: values.filter(value => value === 0).length,
        examples: [...new Set(values.filter(value => value !== null).map(value => JSON.stringify(value)))].slice(0, 3),
      }];
    })),
  };
}

export function keyCheck(rows: Row[], fields: string[]) {
  const missing = rows.filter(row => fields.some(field => row[field] === null || row[field] === undefined)).length;
  const keys = rows.filter(row => fields.every(field => row[field] !== null && row[field] !== undefined))
    .map(row => JSON.stringify(fields.map(field => row[field])));
  return { fields, missing, duplicates: keys.length - new Set(keys).size };
}

export function completedSessions(rows: Row[], now = Date.now()) {
  return rows.filter(row => row.session_name === 'Race' && row.is_cancelled !== true &&
    typeof row.date_end === 'string' && Date.parse(row.date_end) < now &&
    typeof row.session_key === 'number').sort((a, b) => String(a.date_start).localeCompare(String(b.date_start)));
}
