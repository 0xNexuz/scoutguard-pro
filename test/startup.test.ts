import { it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const script = `
import app from './src/index.ts';
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const root = 'http://127.0.0.1:' + server.address().port;
const health = await fetch(root + '/api/health');
const protectedRoute = await fetch(root + '/api/evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
const invalidPublic = await fetch(root + '/api/evaluate/public', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
console.log(JSON.stringify({ health: health.status, protectedRoute: protectedRoute.status, invalidPublic: invalidPublic.status }));
server.close();
`;
function boot(overrides: Record<string, string>) {
  return spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 15000,
    env: { ...process.env, NODE_ENV: 'production', VERCEL: '', VERCEL_ENV: '',
      SCOUTGUARD_SERVICE_KEY: '', BLOCKSCOUT_API_KEY: '', ...overrides }
  });
}
it('confirmed credential-free Vercel preview serves health but keeps protected evaluation locked', () => {
  const result = boot({ VERCEL: '1', VERCEL_ENV: 'preview' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { health: 200, protectedRoute: 401, invalidPublic: 400 });
});
it('production and unconfirmed preview environments still reject a missing service key', () => {
  for (const env of [{ VERCEL: '1', VERCEL_ENV: 'production' }, { VERCEL: '', VERCEL_ENV: 'preview' }]) {
    const result = boot(env);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /SCOUTGUARD_SERVICE_KEY is required in production/);
  }
});
it('production still rejects a missing provider key after service-key configuration', () => {
  const result = boot({ VERCEL: '1', VERCEL_ENV: 'production', SCOUTGUARD_SERVICE_KEY: 'isolated-startup-fixture' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BLOCKSCOUT_API_KEY is required in production/);
});
it('configured production still requires request authentication and validates public candidates', () => {
  const result = boot({ VERCEL: '1', VERCEL_ENV: 'production', SCOUTGUARD_SERVICE_KEY: 'isolated-startup-fixture', BLOCKSCOUT_API_KEY: 'fixture-only' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { health: 200, protectedRoute: 401, invalidPublic: 400 });
  assert.doesNotMatch(result.stdout, /isolated-startup-fixture|fixture-only/);
});
