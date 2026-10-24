import { afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { Interface } from 'ethers';
import { ScoutGuard } from '../src/core/scoutguard.js';
import { ReceiptSigner } from '../src/core/receipt-signer.js';
import { normalizePayment } from '../src/core/payment-normalizer.js';
import { runPaymentAgent, assertEvaluationBinding, createServiceEvaluator } from '../src/integration/payment-agent.js';
import { EvaluationResult, TransactionCandidate } from '../src/types/index.js';
import { fixtureClient, sender, recipient, usdc, json } from './fixtures/blockscout.js';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const tx = { from: sender, to: recipient, value: '0.1', chainId: 1 };
const abi = new Interface(['function transfer(address,uint256)']);
const usdcTx = (amount: bigint) => ({ ...tx, to: usdc, value: '0', data: abi.encodeFunctionData('transfer', [recipient, amount]) });
const evaluate = (candidate: TransactionCandidate) => new ScoutGuard({ blockscoutClient: fixtureClient() }).evaluateTransaction(candidate);
function harness(evaluator = evaluate, authorize: () => Promise<boolean> = async () => true) {
  const calls: TransactionCandidate[] = [];
  return { calls, options: { evaluate: evaluator, authorize,
    signer: { signTransaction: async (candidate: Readonly<TransactionCandidate>) => { calls.push(structuredClone(candidate)); return 'MOCK_ONLY'; } } } };
}
it('verified native and direct USDC PASS reach only the isolated signer after downstream authorization', async () => {
  for (const candidate of [tx, usdcTx(250000000n)]) {
    let authorized = 0;
    const h = harness(evaluate, async () => { authorized++; return true; });
    const result = await runPaymentAgent(candidate, h.options);
    assert.equal(result.status, 'SIGNED'); assert.equal(authorized, 1);
    assert.deepEqual(h.calls, [candidate]);
  }
});
for (const [amount, status] of [[1500000000n, 'REVIEW_REQUIRED'], [3000000000n, 'BLOCKED']] as const) {
  it(`${status} never reaches signing or automatic downstream approval`, async () => {
    let approvals = 0;
    const h = harness(evaluate, async () => { approvals++; return true; });
    assert.equal((await runPaymentAgent(usdcTx(amount), h.options)).status, status);
    assert.equal(h.calls.length, 0); assert.equal(approvals, 0);
  });
}
it('PASS without separate downstream authorization cannot sign', async () => {
  const h = harness(evaluate, async () => false);
  assert.equal((await runPaymentAgent(tx, h.options)).status, 'AUTHORIZATION_DENIED');
  assert.equal(h.calls.length, 0);
});
it('service outage or malformed envelope fails closed and never exposes raw transport errors', async () => {
  for (const evaluator of [async () => { throw new Error('apikey=SECRET'); }, async () => ({}) as EvaluationResult]) {
    const h = harness(evaluator);
    const result = await runPaymentAgent(tx, h.options);
    assert.equal(result.status, 'FAILED_CLOSED'); assert.equal(h.calls.length, 0);
    assert.doesNotMatch(JSON.stringify(result), /SECRET|apikey/);
  }
});
it('an earlier PASS cannot be reused for different sender, recipient, chain, amount, asset or agent', async () => {
  const result = await evaluate(tx);
  const altered = [ { ...tx, from: recipient }, { ...tx, to: sender }, { ...tx, chainId: 8453 },
    { ...tx, value: '0.2' }, usdcTx(1000000n), { ...tx, agentId: 'treasury-sweeper-02' }, { ...tx, data: '0xabcd' } ];
  for (const candidate of altered) {
    const h = harness(async () => result);
    assert.equal((await runPaymentAgent(candidate, h.options)).status, 'FAILED_CLOSED');
    assert.equal(h.calls.length, 0);
  }
});
it('valid USDC PASS cannot authorize alternate calldata recipient or one-unit amount change', async () => {
  const candidate = usdcTx(250000000n), result = await evaluate(candidate);
  for (const changed of [usdcTx(250000001n), { ...candidate, data: abi.encodeFunctionData('transfer', [sender, 250000000n]) }]) {
    const h = harness(async () => result);
    assert.equal((await runPaymentAgent(changed, h.options)).status, 'FAILED_CLOSED');
    assert.equal(h.calls.length, 0);
  }
});
it('response decision, risk, checks, permission and action must agree with its receipt and policy synthesis', async () => {
  const result = await evaluate(tx);
  const mutations = [
    (e: EvaluationResult) => { e.executionAllowed = false; },
    (e: EvaluationResult) => { e.decision = 'FLAG'; },
    (e: EvaluationResult) => { e.riskScore++; },
    (e: EvaluationResult) => { e.checks[0].detail = 'altered'; },
    (e: EvaluationResult) => { e.suggestedAction = 'ABORT_TRANSACTION'; },
    (e: EvaluationResult) => { e.history!.coverage.sender = recipient; },
    (e: EvaluationResult) => { e.receipt.transactionSummary.data = '0x00'; }
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(result); mutate(changed);
    const h = harness(async () => changed);
    assert.equal((await runPaymentAgent(tx, h.options)).status, 'FAILED_CLOSED'); assert.equal(h.calls.length, 0);
  }
});
it('a self-consistent unkeyed receipt for another transaction still fails binding', async () => {
  const result = await evaluate(tx);
  result.receipt = new ReceiptSigner().generateReceipt(normalizePayment({ ...tx, value: '0.2' }), 'PASS', 0,
    result.checks, result.receipt.blockscoutExplorerUrl, result.history?.coverage);
  assert.equal(new ReceiptSigner().verifyReceipt(result.receipt), true);
  assert.throws(() => assertEvaluationBinding(result, tx), /Transaction binding/);
});
it('stale, future-dated and expired-during-approval evaluations cannot sign', async () => {
  const result = await evaluate(tx);
  for (const now of [result.receipt.timestamp + 30001, result.receipt.timestamp - 2001]) {
    const h = harness(async () => result);
    assert.equal((await runPaymentAgent(tx, { ...h.options, now: () => now })).status, 'FAILED_CLOSED');
    assert.equal(h.calls.length, 0);
  }
  let clock = result.receipt.timestamp;
  const h = harness(async () => result, async () => { clock += 30001; return true; });
  assert.equal((await runPaymentAgent(tx, { ...h.options, now: () => clock })).status, 'FAILED_CLOSED');
  assert.equal(h.calls.length, 0);
});
it('caller mutation during asynchronous evaluation cannot alter the candidate passed to the signer', async () => {
  const candidate = { ...tx };
  const h = harness(async snapshot => { candidate.to = sender; return evaluate(snapshot); });
  assert.equal((await runPaymentAgent(candidate, h.options)).status, 'SIGNED');
  assert.deepEqual(h.calls, [tx]);
});
it('approval callback cannot mutate the transaction snapshot', async () => {
  const h = harness();
  const result = await runPaymentAgent(tx, { ...h.options, authorize: async context => {
    (context.candidate as TransactionCandidate).value = '9'; return true;
  } });
  assert.equal(result.status, 'FAILED_CLOSED'); assert.equal(h.calls.length, 0);
});
it('protected evaluator transport refuses untrusted schemes, URL secrets, redirects and public routes', () => {
  for (const endpoint of ['http://example.com/api/evaluate', 'https://u:p@example.com/api/evaluate',
    'https://example.com/api/evaluate?key=secret', 'https://example.com/api/evaluate/public', 'file:///api/evaluate']) {
    assert.throws(() => createServiceEvaluator({ endpoint, serviceKey: 'fixture' }));
  }
  assert.throws(() => createServiceEvaluator({ endpoint: 'http://127.0.0.1/api/evaluate', serviceKey: 'fixture' }));
});
it('protected service transport sends exact candidate/key with timeout and no redirects', async () => {
  const result = await evaluate(tx);
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), 'https://example.com/api/evaluate');
    assert.equal(init?.redirect, 'error'); assert.ok(init?.signal);
    assert.equal((init?.headers as Record<string, string>)['x-scoutguard-key'], 'fixture-only');
    assert.deepEqual(JSON.parse(String(init?.body)), tx);
    return json(result);
  };
  const evaluator = createServiceEvaluator({ endpoint: 'https://example.com/api/evaluate', serviceKey: 'fixture-only' });
  assertEvaluationBinding(await evaluator(tx), tx);
});
it('transport rejects oversized/non-JSON/non-200 responses without leaking response bodies', async () => {
  const evaluator = createServiceEvaluator({ endpoint: 'https://example.com/api/evaluate', serviceKey: 'fixture' });
  for (const response of [new Response('SECRET', { status: 503 }), new Response('SECRET'), new Response('a'.repeat(1000001))]) {
    globalThis.fetch = async () => response;
    await assert.rejects(evaluator(tx), error => error instanceof Error && !/SECRET/.test(error.message));
  }
});
it('unmodeled signing fields cannot ride along an otherwise approved payment', async () => {
  for (const extra of [{ nonce: 1 }, { gasLimit: '21000' }, { effectiveRecipient: sender }]) {
    const h = harness();
    assert.equal((await runPaymentAgent({ ...tx, ...extra }, h.options)).status, 'FAILED_CLOSED');
    assert.equal(h.calls.length, 0);
  }
});
