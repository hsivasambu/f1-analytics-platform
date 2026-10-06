import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connection, environment, safeError } from '../scripts/db/shared';

test('database targets are explicit and reject ambiguous arguments', () => {
  assert.equal(environment([]), 'development');
  assert.equal(environment(['--env', 'production']), 'production');
  assert.throws(() => environment(['production']), /Use --env/);
  assert.throws(() => environment(['--env', 'preview']), /Use --env/);
});
test('database utilities reject missing, non-Postgres and pooled URLs', () => {
  assert.throws(() => connection(undefined), /missing/);
  assert.throws(() => connection('https://example.com'), /PostgreSQL/);
  assert.throws(() => connection('postgresql://user:test@ep-example-pooler.us-east-1.aws.neon.tech/db'), /direct endpoint/);
});
test('database error output redacts URL credentials', () => {
  const message = safeError(new Error('Failed to connect postgresql://user:TEST_SECRET@example.com/db'));
  assert.ok(!message.includes('TEST_SECRET'));
  assert.match(message, /redacted database URL/);
});
