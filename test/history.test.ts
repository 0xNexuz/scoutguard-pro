import { afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { BlockscoutClient } from '../src/core/blockscout-client.js';
import { createProviderBudget } from '../src/core/provider-budget.js';
import { nativeRow, tokenRow, page, json, sender, recipient, olderRecipient, usdc, txHash } from './fixtures/blockscout.js';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const budget = () => createProviderBudget({ minIntervalMs: 0 });
const client = new BlockscoutClient('fixture-secret');
const history = (limits = {}) => client.getSenderHistory(1, sender, limits, budget());

it('follows official next_page_params deterministically and recovers an older native reference', async () => {
  const calls: URL[] = [];
  globalThis.fetch = async input => {
    const url = new URL(String(input)); calls.push(url);
    if (url.pathname.endsWith('token-transfers')) return json(page());
    if (url.searchParams.has('block_number')) {
      assert.equal(url.searchParams.get('block_number'), '21000000');
      assert.equal(url.searchParams.get('items_count'), '50');
      return json(page([nativeRow({ to: { hash: olderRecipient }, hash: txHash(3), timestamp: '2020-01-01T00:00:00Z' })]));
    }
    return json(page([nativeRow()], { block_number: 21000000, index: 7, items_count: 50 }));
  };
  const result = await history();
  assert.deepEqual(calls.map(url => url.pathname.split('/').at(-1)), ['transactions', 'token-transfers', 'transactions']);
  assert.equal(result.counterparties.length, 2);
  assert.ok(result.counterparties.some(peer => peer.address === olderRecipient));
  assert.equal(result.coverage.paginationComplete, true);
  assert.deepEqual(result.coverage.pagesScanned, { transactions: 2, tokenTransfers: 1 });
  assert.equal(result.coverage.oldestEvidenceAt, '2020-01-01T00:00:00Z');
  assert.ok(calls.every(url => url.origin === 'https://api.blockscout.com' && url.pathname.startsWith('/1/api/v2/')));
});
it('deduplicates native hashes and ERC20 log events but retains different tokens and log indexes', async () => {
  const a = nativeRow(), t = tokenRow();
  globalThis.fetch = async input => json(page(String(input).includes('token-transfers')
    ? [t, t, tokenRow({ log_index: 4 }), tokenRow({ token: { address_hash: olderRecipient, type: 'ERC-20' } })]
    : [a, a]));
  const result = await history();
  assert.equal(result.coverage.recordsInspected, 6);
  assert.equal(result.coverage.duplicatesSkipped, 2);
  assert.equal(result.counterparties[0].totalTransfers, 4);
  assert.equal(result.coverage.outgoingTokenTransfers, 3);
  assert.equal(result.evidence.filter(e => e.tokenAddress === usdc).length, 2);
  assert.equal(result.evidence.find(e => e.tokenAddress)?.initiatorVerified, false);
});
it('incoming spam, zero values, self transfers and failed native calls cannot establish outbound references', async () => {
  globalThis.fetch = async input => json(page(String(input).includes('token-transfers') ? [
    tokenRow({ from: { hash: recipient }, to: { hash: sender } }),
    tokenRow({ total: { value: '0' }, log_index: 4 })
  ] : [nativeRow({ value: '0' }), nativeRow({ hash: txHash(4), status: 'error' }),
    nativeRow({ hash: txHash(5), from: { hash: sender }, to: { hash: sender } })]));
  const result = await history();
  assert.equal(result.counterparties.length, 0);
  assert.equal(result.coverage.incomingOnlyAddresses, 1);
  assert.equal(result.coverage.zeroValueInteractions, 2);
  assert.ok(result.evidence.some(e => e.relationship === 'INCOMING_ONLY'));
  assert.ok(result.evidence.some(e => e.relationship === 'ZERO_VALUE'));
});
it('empty history is explicitly complete only after both terminal pages', async () => {
  globalThis.fetch = async () => json(page());
  const result = await history();
  assert.equal(result.coverage.paginationComplete, true);
  assert.equal(result.coverage.uniqueCounterparties, 0);
});
for (const [limits, reason] of [
  [{ maxPages: 1 }, 'PAGE_LIMIT'], [{ maxRecords: 2 }, 'RECORD_LIMIT'], [{ maxProviderCalls: 2 }, 'REQUEST_BUDGET']
] as const) it(`bounds ongoing cursors with ${reason}`, async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return json(page([nativeRow()], { index: calls })); };
  const result = await history(limits);
  assert.equal(calls, 2);
  assert.equal(result.coverage.truncated, true);
  assert.ok(result.coverage.stopReasons.includes(reason));
});
it('discloses age-window exclusions without claiming lifetime completeness', async () => {
  globalThis.fetch = async input => json(page(String(input).includes('token-transfers') ? [] : [nativeRow()]));
  const result = await history({ maxAgeDays: 1 });
  assert.equal(result.counterparties.length, 0);
  assert.ok(result.coverage.stopReasons.includes('AGE_WINDOW'));
});
for (const status of [402, 429, 503]) {
  it(`HTTP ${status} on critical first page fails closed`, async () => {
    globalThis.fetch = async () => json({ message: 'not forwarded' }, status);
    await assert.rejects(history(), /CRITICAL_HISTORY_UNAVAILABLE/);
  });
  it(`HTTP ${status} after valid first pages discloses partial coverage`, async () => {
    globalThis.fetch = async input => {
      const url = new URL(String(input));
      return url.searchParams.has('index') ? json({}, status) : json(page([], { index: 1 }));
    };
    const result = await history();
    assert.ok(result.coverage.providerErrors.some(e => e.code === `HTTP_${status}`));
    assert.equal(result.coverage.truncated, true);
  });
}
it('timeouts do not erase valid partial evidence', async () => {
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    if (url.searchParams.has('index')) throw new DOMException('secret URL must not escape', 'TimeoutError');
    return json(page([nativeRow()], { index: 1 }));
  };
  const result = await history();
  assert.ok(result.coverage.timeBudgetExhausted);
  assert.equal(result.counterparties.length, 1);
  assert.equal(result.coverage.providerErrors[0].code, 'TIMEOUT');
});
it('honors total duration while scanning and never retries', async () => {
  const scope = budget();
  let calls = 0;
  globalThis.fetch = async () => { if (++calls === 2) scope.deadline = Date.now() - 1; return json(page([], { index: calls })); };
  const result = await client.getSenderHistory(1, sender, {}, scope);
  assert.equal(result.coverage.timeBudgetExhausted, true);
  assert.equal(result.coverage.providerCalls, 2);
});
for (const cursor of [undefined, {}, { apikey: 'stolen' }, { index: { bad: true } }]) {
  it(`rejects malformed or credential-changing cursor ${JSON.stringify(cursor)}`, async () => {
    globalThis.fetch = async () => json({ items: [], next_page_params: cursor });
    const result = await history();
    assert.equal(result.coverage.truncated, true);
    assert.ok(result.coverage.stopReasons.includes('MALFORMED_CURSOR'));
  });
}
it('stops a repeated cursor and discloses malformed records', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return json(page([null, nativeRow({ value: '-1' })], { index: 1 })); };
  const result = await history();
  assert.equal(calls, 4);
  assert.equal(result.counterparties.length, 0);
  assert.ok(result.coverage.stopReasons.includes('REPEATED_CURSOR'));
  assert.ok(result.coverage.stopReasons.includes('MALFORMED_RECORD'));
});
it('rejects malformed history envelopes', async () => {
  globalThis.fetch = async () => json({ items: 'bad' });
  await assert.rejects(history(), /CRITICAL_HISTORY_UNAVAILABLE/);
});
it('request scope caps all provider methods including contracts, and isolates chain paths', async () => {
  const paths: string[] = [];
  globalThis.fetch = async input => { paths.push(new URL(String(input)).pathname); return json({ is_verified: true }); };
  const scope = createProviderBudget({ maxCalls: 1, minIntervalMs: 0 });
  await client.getContractSecurity(8453, usdc, scope);
  await assert.rejects(client.getContractSecurity(1, usdc, scope), /REQUEST_BUDGET/);
  assert.equal(paths.length, 1);
  assert.ok(paths[0].startsWith('/8453/'));
});
it('validates bounds before consuming any quota', async () => {
  globalThis.fetch = async () => { throw new Error('should not fetch'); };
  for (const limits of [{ maxPages: 0 }, { maxRecords: Infinity }, { maxProviderCalls: 99 }, { maxDurationMs: -1 }, { maxAgeDays: NaN }]) {
    await assert.rejects(history(limits), /Invalid history/);
  }
});

it('respects an exhausted shared evaluation budget even when history has its own allowance', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return json(page()); };
  await assert.rejects(client.getSenderHistory(1, sender, {}, createProviderBudget({ maxCalls: 0, minIntervalMs: 0 })), /CRITICAL_HISTORY_UNAVAILABLE/);
  assert.equal(calls, 0);
});
it('missing event metadata is disclosed as incomplete evidence and cannot silently claim complete history', async () => {
  globalThis.fetch = async input => json(page(String(input).includes('token-transfers') ? [tokenRow({ log_index: undefined, timestamp: undefined })] : []));
  const result = await history();
  assert.equal(result.counterparties.length, 1);
  assert.equal(result.coverage.paginationComplete, false);
  assert.equal(result.evidence[0].relationship, 'INCOMPLETE');
});

it('critical history failure retains machine-readable provider errors for the fail-closed response', async () => {
  globalThis.fetch = async () => json({ message: 'private content' }, 429);
  try { await history(); assert.fail('must reject'); } catch (error: any) {
    assert.equal(error.code, 'CRITICAL_HISTORY_UNAVAILABLE');
    assert.equal(error.history.coverage.providerErrors[0].code, 'HTTP_429');
    assert.equal(error.history.coverage.paginationComplete, false);
    assert.equal(error.history.coverage.providerCalls, 2);
  }
});
