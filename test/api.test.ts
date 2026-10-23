import { afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import { Server } from 'node:http';
import { Interface } from 'ethers';
import { createApp } from '../src/index.js';
import { ScoutGuard } from '../src/core/scoutguard.js';
import { fixtureClient, sender, recipient, usdc } from './fixtures/blockscout.js';
const servers: Server[] = [];
const oldKey = process.env.SCOUTGUARD_SERVICE_KEY;
const oldVercel = process.env.VERCEL;
afterEach(async () => {
  if (oldKey === undefined) delete process.env.SCOUTGUARD_SERVICE_KEY; else process.env.SCOUTGUARD_SERVICE_KEY = oldKey;
  if (oldVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = oldVercel;
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
});
async function setup(options: Parameters<typeof createApp>[0] = {}) {
  const app = createApp({ guard: new ScoutGuard({ blockscoutClient: fixtureClient() }), ...options });
  const server = await new Promise<Server>(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  servers.push(server);
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { url, post: (body: unknown, route = '/api/evaluate/public', headers: Record<string, string> = {}) =>
    fetch(url + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }) };
}
const native = { from: sender, to: recipient, value: '0.1', chainId: 1 };
const token = { ...native, to: usdc, value: '0', data: new Interface(['function transfer(address,uint256)']).encodeFunctionData('transfer', [recipient, 250000000n]) };

it('guest Ethereum ETH/USDC evaluations return LIVE provenance, exact binding and no-store', async () => {
  const { post } = await setup();
  for (const payment of [native, token]) {
    const response = await post(payment);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json();
    assert.equal(body.mode, 'LIVE');
    assert.equal(body.source, process.env.BLOCKSCOUT_API_KEY ? 'BLOCKSCOUT_PRO' : 'BLOCKSCOUT_PUBLIC_API');
    assert.equal(body.evaluation.decision, 'PASS');
    assert.equal(body.evaluation.receipt.transactionSummary.to.toLowerCase(), recipient);
    assert.equal(body.evaluation.history.coverage.paginationComplete, true);
  }
});
it('protected endpoint denies missing/wrong keys, works with correct key, and denies an unconfigured key', async () => {
  process.env.SCOUTGUARD_SERVICE_KEY = 'private-test-service-key';
  const { post } = await setup();
  assert.equal((await post(native, '/api/evaluate')).status, 401);
  assert.equal((await post(native, '/api/evaluate', { 'x-scoutguard-key': 'incorrect' })).status, 401);
  const valid = await post(native, '/api/evaluate', { 'x-scoutguard-key': 'private-test-service-key' });
  assert.equal(valid.status, 200);
  assert.doesNotMatch(await valid.text(), /private-test-service-key|fixture-key/);
  delete process.env.SCOUTGUARD_SERVICE_KEY;
  assert.equal((await post(native, '/api/evaluate')).status, 401);
});
it('invalid input/coercions/unknown fields and false raw assertions consume no provider calls', async () => {
  let calls = 0;
  const client = fixtureClient();
  client.getAddressCounters = async () => { calls++; throw new Error('should not fetch'); };
  const { post } = await setup({ guard: new ScoutGuard({ blockscoutClient: client }), publicLimit: 50, aggregateLimit: 50 });
  for (const body of [null, [], {}, { ...native, chainId: '1' }, { ...native, value: 0.1 },
    { ...native, data: {} }, { ...native, chainId: 8453 }, { ...native, rawAmount: '1' },
    { ...native, unexpected: true }, { ...native, transactionTo: usdc }]) {
    assert.equal((await post(body)).status, 400, JSON.stringify(body));
  }
  assert.equal(calls, 0);
});
it('malformed JSON and oversized requests produce bounded JSON without reflected bodies', async () => {
  const { url, post } = await setup();
  const malformed = await fetch(url + '/api/evaluate/public', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{SECRET-BODY' });
  assert.equal(malformed.status, 400);
  assert.doesNotMatch(await malformed.text(), /SECRET-BODY|SyntaxError|stack/);
  assert.equal((await post({ ...native, memo: 'a'.repeat(17000) })).status, 413);
});
it('provider failures BLOCK without leaking credentials and trigger cooldown without another call', async () => {
  const client = fixtureClient();
  let calls = 0;
  client.getAddressCounters = async () => { calls++; throw new Error('https://api.blockscout.com/?apikey=SECRET&authorization=PRIVATE'); };
  const { post } = await setup({ guard: new ScoutGuard({ blockscoutClient: client }) });
  const first = await post(native);
  const text = await first.text();
  assert.equal(JSON.parse(text).evaluation.decision, 'BLOCK');
  assert.doesNotMatch(text, /SECRET|PRIVATE|authorization=|apikey=/);
  const second = await post(native);
  assert.equal(second.status, 503);
  assert.ok(second.headers.get('retry-after'));
  assert.equal(calls, 1);
});
it('per-IP limiter returns 429 and direct requests cannot evade it by forging forwarded IPs', async () => {
  delete process.env.VERCEL;
  const { post } = await setup({ publicLimit: 1 });
  assert.equal((await post(native, undefined, { 'x-forwarded-for': '203.0.113.1' })).status, 200);
  const limited = await post(native, undefined, { 'x-forwarded-for': '203.0.113.2' });
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get('retry-after'));
  assert.equal(limited.headers.get('cache-control'), 'no-store');
});
it('aggregate limiter caps a process independently of the per-client limit', async () => {
  const { post } = await setup({ publicLimit: 10, aggregateLimit: 1 });
  assert.equal((await post(native)).status, 200);
  const second = await post(native);
  assert.equal(second.status, 429);
  assert.match(await second.text(), /provider budget/);
});
it('concurrency cap rejects excess work before evaluating it', async () => {
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const real = new ScoutGuard({ blockscoutClient: fixtureClient() });
  let entered!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const guard = Object.assign(new ScoutGuard(), { evaluateTransaction: async (tx: any) => { entered(); await waiting; return real.evaluateTransaction(tx); } });
  const { post } = await setup({ guard, maxConcurrent: 1 });
  const first = post(native);
  await started;
  try { assert.equal((await post(native)).status, 429); } finally { release(); }
  assert.equal((await first).status, 200);
});
it('homepage, research replay, simulations and explorer links preserve evidence categories', async () => {
  const { url } = await setup();
  const root = await fetch(url);
  assert.equal(root.status, 200);
  assert.match(await root.text(), /live-form|live-check|live-/);
  const replay = await (await fetch(url + '/api/research-case/poisoning')).json();
  assert.equal(replay.mode, 'RECORDED_RESEARCH_REPLAY');
  assert.equal(replay.decision, 'BLOCK');
  assert.match(replay.limitation, /not a live detection/);
  assert.ok(replay.blockscoutTxUrl.startsWith('https://eth.blockscout.com/tx/0x'));
  for (const [scenario, decision] of [['legitimate-vendor', 'PASS'], ['address-poisoning', 'BLOCK'], ['unverified-contract', 'FLAG'], ['malicious-phishing', 'BLOCK'], ['spending-cap-breach', 'BLOCK']]) {
    const result = await (await fetch(url + '/api/simulate/' + scenario, { method: 'POST' })).json();
    assert.equal(result.mode, 'SIMULATED');
    assert.equal(result.evaluation.decision, decision);
  }
});

it('compressed request bodies are rejected before decompression', async () => {
  const { url } = await setup();
  const response = await fetch(url + '/api/evaluate/public', { method: 'POST', headers: {
    'Content-Type': 'application/json', 'Content-Encoding': 'gzip'
  }, body: new Uint8Array([31, 139, 8, 0]) });
  assert.equal(response.status, 415);
  assert.match(await response.text(), /unsupported/);
});
