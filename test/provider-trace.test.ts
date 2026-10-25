import { afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createProviderBudget, requestJson } from '../src/core/provider-budget.js';
import { ReceiptSigner } from '../src/core/receipt-signer.js';
import { classifyProviderSource } from '../src/core/provider-source.js';
import { ScoutGuard } from '../src/core/scoutguard.js';
import { BlockscoutClient } from '../src/core/blockscout-client.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const metadata = { chainId: 1, endpoint: 'SENDER_TOKEN_TRANSFERS' as const, source: 'BLOCKSCOUT_PRO' as const, page: 2 };
const credentialUrl = 'https://api.blockscout.com/1/api/v2/addresses/0xabc/token-transfers?apikey=PRIVATE_TEST_KEY';

it('classifies provider source from completed requests, including partial failures', () => {
  const base = { evaluationId: 'test', chainId: 1, endpoint: 'ADDRESS_DETAILS' as const,
    source: 'BLOCKSCOUT_PRO' as const, durationMs: 1, timestamp: '2026-10-25T00:00:00Z' };
  assert.equal(classifyProviderSource(undefined), 'NO_PROVIDER_TRACE');
  assert.equal(classifyProviderSource([{ ...base, errorCategory: 'TIMEOUT' }]), 'BLOCKSCOUT_UNAVAILABLE');
  assert.equal(classifyProviderSource([{ ...base, httpStatus: 200 }]), 'BLOCKSCOUT_PRO');
  assert.equal(classifyProviderSource([{ ...base, httpStatus: 200 }, { ...base, errorCategory: 'TIMEOUT' }]), 'BLOCKSCOUT_PRO_PARTIAL');
  assert.equal(classifyProviderSource([{ ...base, httpStatus: 200, errorCategory: 'MALFORMED_RESPONSE' }]), 'BLOCKSCOUT_UNAVAILABLE');
});

it('records actual HTTP status, row count and pagination without retaining credentials', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ items: [{ id: 1 }, { id: 2 }], next_page_params: { index: 3 } }), { status: 200 });
  const budget = createProviderBudget({ minIntervalMs: 0 });
  await requestJson(credentialUrl, budget, metadata);
  assert.equal(budget.trace.length, 1);
  assert.deepEqual({ status: budget.trace[0].httpStatus, rows: budget.trace[0].recordCount,
    next: budget.trace[0].hasNextPage, page: budget.trace[0].page }, { status: 200, rows: 2, next: true, page: 2 });
  assert.equal(budget.trace[0].evaluationId, budget.evaluationId);
  assert.ok(Number.isSafeInteger(budget.trace[0].durationMs));
  assert.doesNotMatch(JSON.stringify(budget.trace), /PRIVATE_TEST_KEY|apikey|\/api\/v2\/addresses/);
});

it('records failed upstream status and sanitized category without a response body', async () => {
  globalThis.fetch = async () => new Response('PRIVATE_TEST_KEY', { status: 429 });
  const budget = createProviderBudget({ minIntervalMs: 0 });
  await assert.rejects(requestJson(credentialUrl, budget, metadata), /HTTP_429/);
  assert.equal(budget.trace[0].httpStatus, 429);
  assert.equal(budget.trace[0].errorCategory, 'HTTP_429');
  assert.doesNotMatch(JSON.stringify(budget.trace), /PRIVATE_TEST_KEY/);
});

it('does not classify HTTP 200 with malformed provider data as a successful lookup', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ transactions_count: '-1', token_transfers_count: '0', gas_usage_count: '0' }));
  const budget = createProviderBudget({ minIntervalMs: 0 });
  await assert.rejects(new BlockscoutClient('fixture-key').getAddressCounters(1, `0x${'2'.repeat(40)}`, budget), /MALFORMED_COUNTERS/);
  assert.equal(budget.trace[0].httpStatus, 200);
  assert.equal(budget.trace[0].errorCategory, 'MALFORMED_COUNTERS');
  assert.equal(classifyProviderSource(budget.trace), 'BLOCKSCOUT_UNAVAILABLE');
});

it('includes trace in the receipt consistency digest', () => {
  const trace = [{ evaluationId: 'test-evaluation', chainId: 1, endpoint: 'ADDRESS_DETAILS' as const,
    source: 'BLOCKSCOUT_PRO' as const, httpStatus: 200, durationMs: 16, timestamp: '2026-10-25T00:00:00Z' }];
  const signer = new ReceiptSigner();
  const receipt = signer.generateReceipt({ from: `0x${'1'.repeat(40)}`, to: `0x${'2'.repeat(40)}`, value: '0.1', chainId: 1 },
    'PASS', 0, [{ id: 'test', name: 'Test', status: 'PASS', scoreImpact: 0, detail: 'test' }], '', undefined, trace);
  assert.equal(signer.verifyReceipt(receipt), true);
  receipt.providerTrace![0].httpStatus = 429;
  assert.equal(signer.verifyReceipt(receipt), false);
});

it('settles canceled sibling requests before sealing a fail-closed trace', async () => {
  globalThis.fetch = async (input, options) => {
    const url = String(input);
    if (url.endsWith('/counters?apikey=fixture-key')) return new Response(JSON.stringify({ transactions_count: '1', token_transfers_count: '0', gas_usage_count: '0' }));
    if (/\/addresses\/0x[2]+\?apikey=fixture-key$/.test(url)) return new Response('{}', { status: 503 });
    return new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new DOMException('canceled', 'AbortError')), { once: true });
    });
  };
  const evaluation = await new ScoutGuard({ apiKey: 'fixture-key' }).evaluateTransaction({
    from: `0x${'1'.repeat(40)}`, to: `0x${'2'.repeat(40)}`, value: '0.1', chainId: 1
  });
  assert.equal(evaluation.decision, 'BLOCK');
  assert.deepEqual(evaluation.providerTrace, evaluation.receipt.providerTrace);
  assert.equal(new ReceiptSigner().verifyReceipt(evaluation.receipt), true);
  assert.ok(evaluation.providerTrace?.some(row => row.httpStatus === 503));
  assert.ok(evaluation.providerTrace?.every(row => row.durationMs >= 0 && (row.httpStatus !== undefined || row.errorCategory)));
});
