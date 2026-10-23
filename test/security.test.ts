import { afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { Interface, MaxUint256, parseUnits } from 'ethers';
import { PoisoningDetector } from '../src/core/poisoning-detector.js';
import { normalizePayment } from '../src/core/payment-normalizer.js';
import { PolicyEngine, DEFAULT_AGENT_POLICIES } from '../src/core/policy-engine.js';
import { ScoutGuard } from '../src/core/scoutguard.js';
import { ReceiptSigner } from '../src/core/receipt-signer.js';
import { BlockscoutClient } from '../src/core/blockscout-client.js';
import { createProviderBudget } from '../src/core/provider-budget.js';
import { KnownCounterparty } from '../src/types/index.js';
import { completeHistory, fixtureClient, sender, recipient, usdc, json } from './fixtures/blockscout.js';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const abi = new Interface(['function transfer(address,uint256)', 'function transferFrom(address,address,uint256)', 'function approve(address,uint256)']);
const native = { from: sender, to: recipient, value: '0.1', chainId: 1 };
const token = (amount = 250000000n) => ({ ...native, to: usdc, value: '0', data: abi.encodeFunctionData('transfer', [recipient, amount]) });
const peer = (address: string, source: KnownCounterparty['source'] = 'BLOCKSCOUT_HISTORY'): KnownCounterparty => ({
  address, name: 'Fixture', category: 'VENDOR', verifiedSince: 'fixture', totalTransfers: 1, source
});
const candidate = '0xabcd999999999999999999999999999999991234';
const weak = peer('0xabcd111111111111111111111111111111119999');
const strong = peer('0xabcd111111111111111111111111111111111234');
const detector = new PoisoningDetector();

it('selects strongest poisoning match regardless of history order, duplicates or an observed exact match', () => {
  for (const peers of [[weak, strong], [strong, weak], [peer(candidate), weak, strong, strong], [strong, peer(candidate)]]) {
    const found = detector.detectVanityCollision(candidate, peers);
    assert.equal(found.severity, 'CRITICAL');
    assert.equal(found.matchedVendor?.address, strong.address);
  }
});
it('ties are deterministic and prefix-only/suffix-only collisions require review', () => {
  assert.equal(detector.detectVanityCollision(candidate, [weak]).severity, 'SUSPICIOUS');
  const suffix = peer(`0x${'7'.repeat(35)}91234`);
  assert.equal(detector.detectVanityCollision(candidate, [suffix]).severity, 'SUSPICIOUS');
  const tied = peer(strong.address.replace('11111111', '22222222'));
  assert.deepEqual(detector.detectVanityCollision(candidate, [strong, tied]), detector.detectVanityCollision(candidate, [tied, strong]));
  const unrelated = peer(`0xabc${'7'.repeat(33)}1234`);
  assert.equal(detector.detectVanityCollision(candidate, [unrelated]).severity, 'CLEAN');
});
it('empty references never assert address safety and invalid references fail closed', () => {
  assert.match(detector.detectVanityCollision(candidate, []).explanation, /not proof/);
  assert.throws(() => detector.detectVanityCollision(candidate, [peer('0x123')]), /Invalid comparison/);
});
it('an observed exact match describes history rather than trust', () => {
  const result = detector.evaluatePoisoningRisk(recipient, { transactionsCount: 2, tokenTransfersCount: 1, gasUsageCount: 0, isContract: false }, [peer(recipient)], 'fixture');
  assert.equal(result.name, 'Observed Counterparty History');
  assert.equal(result.metadata?.source, 'BLOCKSCOUT_HISTORY');
});
it('incomplete valid history cannot PASS even for a configured exact counterparty', async () => {
  const history = completeHistory({ paginationComplete: false, truncated: true, stopReasons: ['PAGE_LIMIT'] });
  const result = await new ScoutGuard({ blockscoutClient: fixtureClient(history), customCounterparties: [peer(recipient, 'CONFIGURED')] }).evaluateTransaction(native);
  assert.equal(result.decision, 'FLAG');
  assert.equal(result.executionAllowed, false);
  assert.ok(result.checks.some(c => c.id === 'SEC-HISTORY-INCOMPLETE'));
  assert.deepEqual(result.receipt.historyCoverage, history.coverage);
});
it('complete empty comparison set is disclosed and provider absence blocks', async () => {
  const client = fixtureClient();
  const result = await new ScoutGuard({ blockscoutClient: client }).evaluateTransaction(native);
  assert.equal(result.history?.coverage.uniqueCounterparties, 0);
  assert.equal(result.checks[0].metadata?.counterpartiesCompared, 0);
  client.getSenderHistory = async () => { throw new Error('https://provider?apikey=DO_NOT_LEAK'); };
  const failed = await new ScoutGuard({ blockscoutClient: client }).evaluateTransaction(native);
  assert.equal(failed.decision, 'BLOCK');
  assert.doesNotMatch(JSON.stringify(failed), /DO_NOT_LEAK/);
});
it('chain-scoped operator references do not contaminate another chain', async () => {
  const result = await new ScoutGuard({ blockscoutClient: fixtureClient(), customCounterparties: [{ ...strong, chainId: 8453 }] })
    .evaluateTransaction({ ...native, to: candidate });
  assert.equal(result.checks[0].metadata?.counterpartiesCompared, 0);
});
it('USDC checks inspect decoded beneficiary, not token destination; native still passes', async () => {
  const visited: string[] = [];
  const client = fixtureClient();
  client.getAddressCounters = async (_chain, address) => { visited.push(address.toLowerCase()); return { transactionsCount: 12, tokenTransfersCount: 1, gasUsageCount: 0, isContract: false }; };
  const guard = new ScoutGuard({ blockscoutClient: client });
  const result = await guard.evaluateTransaction(token());
  assert.equal(result.decision, 'PASS');
  assert.deepEqual(visited, [recipient]);
  assert.equal(result.receipt.transactionSummary.transactionTo?.toLowerCase(), usdc);
  assert.equal(result.receipt.transactionSummary.to.toLowerCase(), recipient);
  assert.equal((await guard.evaluateTransaction(native)).decision, 'PASS');
});
it('USDC poisoning resemblance blocks the decoded beneficiary', async () => {
  const history = { ...completeHistory(), counterparties: [strong] };
  const result = await new ScoutGuard({ blockscoutClient: fixtureClient(history) }).evaluateTransaction({ ...token(), data: abi.encodeFunctionData('transfer', [candidate, 1000000n]) });
  assert.equal(result.decision, 'BLOCK');
  assert.equal(result.checks[0].id, 'SEC-POISON-01');
});
it('USDC caps and human thresholds use six-decimal exact units including one-unit boundaries', async () => {
  const guard = new ScoutGuard({ blockscoutClient: fixtureClient() });
  for (const [amount, decision] of [[1000000000n, 'PASS'], [1000000001n, 'FLAG'], [2500000000n, 'FLAG'], [2500000001n, 'BLOCK'], [MaxUint256, 'BLOCK'], [1n, 'PASS']] as const) {
    assert.equal((await guard.evaluateTransaction(token(amount))).decision, decision, String(amount));
  }
});
const zeroAddress = `0x${'0'.repeat(40)}`;
const badPayments = [
  { ...token(), to: recipient },
  { ...token(), chainId: 42161 },
  { ...token(), chainId: 8453 }, // Ethereum token contract on Base
  { ...token(), value: '0.000000000000000001' },
  { ...token(), tokenAddress: recipient },
  { ...token(), rawAmount: '1' },
  { ...native, rawAmount: '1' },
  { ...native, transactionTo: usdc },
  { ...native, transactionValue: '2' },
  { ...token(), data: abi.encodeFunctionData('transferFrom', [sender, recipient, 1n]) },
  { ...token(), data: abi.encodeFunctionData('approve', [recipient, 1n]) },
  { ...token(), data: token().data.slice(0, -2) },
  { ...token(), data: `${token().data}00` },
  { ...token(), data: `0xa9059cbb1${token().data.slice(11)}` },
  { ...token(), data: abi.encodeFunctionData('transfer', [zeroAddress, 1n]) },
  { ...native, to: zeroAddress },
  { ...token(0n) }, { ...native, value: '0' },
  { ...native, value: '-1' }, { ...native, value: '1e3' },
  { ...native, value: '0.0000000000000000001' },
  { ...native, data: 123 }, { ...native, chainId: '1' },
  { ...native, to: 'not-address' }, { ...native, value: (MaxUint256 + 1n).toString() }
];
const attackNames = ['wrong token contract', 'unsupported token chain', 'cross-chain token contract', 'nonzero native token value', 'false token assertion', 'false USDC raw amount', 'false native raw amount', 'false transaction destination', 'false transaction value', 'transferFrom', 'approve selector', 'truncated calldata', 'trailing calldata', 'noncanonical address padding', 'zero token recipient', 'zero native recipient', 'zero token amount', 'zero native amount', 'negative amount', 'scientific notation', 'fractional wei', 'object calldata', 'string chain ID', 'invalid recipient', 'native uint256 overflow'];
for (const [index, payment] of badPayments.entries()) it(`rejects ${attackNames[index]} before provider access`, async () => {
  assert.throws(() => normalizePayment(payment as any));
  const client = fixtureClient();
  client.getSenderHistory = async () => { assert.fail('Provider must not be called'); };
  const result = await new ScoutGuard({ blockscoutClient: client }).evaluateTransaction(payment as any);
  assert.equal(result.decision, 'BLOCK');
  assert.equal(result.executionAllowed, false);
});
it('unverified or unavailable canonical token metadata cannot PASS', async () => {
  const client = fixtureClient();
  client.getContractSecurity = async () => ({ isContract: true, isVerified: false });
  const guard = new ScoutGuard({ blockscoutClient: client });
  assert.equal((await guard.evaluateTransaction(token())).decision, 'BLOCK');
  client.getContractSecurity = async () => { throw new Error('unavailable'); };
  assert.equal((await guard.evaluateTransaction(token())).decision, 'BLOCK');
});
it('valid Base canonical calldata normalizes without implying live plan access', () => {
  const payment = normalizePayment({ ...token(), chainId: 8453, to: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' });
  assert.equal(payment.rawAmount, '250000000');
});
it('provider schemas reject negative/null counters and truthy nonboolean verification', async () => {
  const client = new BlockscoutClient();
  for (const value of [-1, null, '', {}, 'Infinity', '2.2', 9007199254740992]) {
    globalThis.fetch = async () => json({ transactions_count: value, token_transfers_count: '1' });
    await assert.rejects(client.getAddressCounters(1, recipient), /MALFORMED_COUNTERS/);
  }
  globalThis.fetch = async () => json({ is_verified: 'false', source_code: {} });
  await assert.rejects(client.getContractSecurity(1, usdc), /MALFORMED_CONTRACT/);
  globalThis.fetch = async () => json({ is_contract: 'false' });
  await assert.rejects(client.getAddressDetails(1, recipient), /MALFORMED_ADDRESS/);
});
it('provider timeout bounds a real abort-aware pending fetch, without retries', async () => {
  let count = 0;
  globalThis.fetch = async (_input, init) => {
    count++;
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('timed out', 'TimeoutError')));
      // Keep test event loop alive until AbortSignal fires.
      setTimeout(() => reject(new DOMException('timed out', 'TimeoutError')), 30);
    });
  };
  await assert.rejects(new BlockscoutClient().getAddressCounters(1, recipient, createProviderBudget({ requestTimeoutMs: 10 })), /TIMEOUT/);
  assert.equal(count, 1);
});
it('receipt verification binds transaction, checks, policy, decision, timestamps, asset and evidence', async () => {
  const result = await new ScoutGuard({ blockscoutClient: fixtureClient() }).evaluateTransaction(token());
  const signer = new ReceiptSigner();
  const receipt = JSON.parse(JSON.stringify(result.receipt));
  assert.equal(signer.verifyReceipt(receipt), true);
  const mutations = [
    (r: any) => r.transactionSummary.chainId++, (r: any) => r.transactionSummary.from = recipient,
    (r: any) => r.transactionSummary.to = sender, (r: any) => r.transactionSummary.transactionTo = recipient,
    (r: any) => r.transactionSummary.tokenAddress = recipient, (r: any) => r.transactionSummary.asset = 'NATIVE',
    (r: any) => r.transactionSummary.rawAmount = '1', (r: any) => r.transactionSummary.value = '0.1',
    (r: any) => r.transactionSummary.transactionValue = '1', (r: any) => r.transactionSummary.data += '00',
    (r: any) => r.policyVersion = 'other', (r: any) => r.decision = 'BLOCK', (r: any) => r.timestamp++,
    (r: any) => r.checks[0].status = 'FAIL', (r: any) => r.checks[0].detail = 'altered',
    (r: any) => r.blockscoutExplorerUrl = 'https://evil.example', (r: any) => r.historyCoverage.paginationComplete = false,
    (r: any) => r.agentId = 'other'
  ];
  for (const mutate of mutations) { const changed = structuredClone(receipt); mutate(changed); assert.equal(signer.verifyReceipt(changed), false); }
  const reordered = Object.fromEntries(Object.entries(receipt).reverse()) as any;
  assert.equal(signer.verifyReceipt(reordered), true);
});

it('recipient allowlist policy is enforced against the decoded effective USDC recipient', () => {
  const policy = { ...DEFAULT_AGENT_POLICIES['procurement-bot-01'], enforceWhitelist: true, whitelistedAddresses: [usdc] };
  const engine = new PolicyEngine([policy]);
  const payment = normalizePayment(token());
  const tokenConfig = new BlockscoutClient().getTokenConfig(1, usdc);
  assert.equal(engine.evaluatePolicy(payment, '', tokenConfig).id, 'SEC-POLICY-WHITELIST');
  policy.whitelistedAddresses = [recipient];
  assert.equal(new PolicyEngine([policy]).evaluatePolicy(payment, '', tokenConfig).status, 'PASS');
});
it('unavailable history evidence never emits an unrelated historical transaction link', async () => {
  const result = await new ScoutGuard({ blockscoutClient: fixtureClient() }).evaluateTransaction(native);
  assert.equal(result.checks.some(check => check.metadata?.observedTransactionUrl), false);
});
it('runtime-invalid SDK input still returns fail-closed BLOCK', async () => {
  for (const input of [null, undefined]) {
    const result = await new ScoutGuard({ blockscoutClient: fixtureClient() }).evaluateTransaction(input as any);
    assert.equal(result.decision, 'BLOCK');
  }
});
it('real client methods integrate API v2 fixtures through the USDC engine and select only influencing transaction evidence', async () => {
  const { page, nativeRow, tokenRow, txHash } = await import('./fixtures/blockscout.js');
  const visited: string[] = [];
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    visited.push(url.pathname);
    if (url.pathname.endsWith('/counters')) return json({ transactions_count: '12', token_transfers_count: '8', gas_usage_count: '10' });
    if (url.pathname.endsWith('/token-transfers')) return json(page([tokenRow()]));
    if (url.pathname.endsWith('/transactions')) return json(page([nativeRow()]));
    if (url.pathname.includes('/smart-contracts/')) return json({ name: 'FiatTokenProxy', is_verified: true, source_code: 'contract fixture {}', implementations: [] });
    return json({ hash: recipient, is_contract: false, public_tags: [], is_scam: false });
  };
  const result = await new ScoutGuard({ blockscoutClient: new BlockscoutClient('fixture-secret') }).evaluateTransaction(token());
  assert.equal(result.decision, 'PASS');
  assert.equal(result.history?.coverage.outgoingNativeTransfers, 1);
  assert.equal(result.history?.coverage.outgoingTokenTransfers, 1);
  assert.equal(result.checks[0].metadata?.observedTransactionUrl, `https://eth.blockscout.com/tx/${txHash()}`);
  assert.equal(visited.length, 5);
  assert.ok(visited.every(path => path.startsWith('/1/api/v2/')));
  assert.doesNotMatch(JSON.stringify(result), /fixture-secret/);
});
it('a critical provider failure cancels queued sibling calls instead of spending the remaining request budget', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return json({}, 503); };
  const result = await new ScoutGuard({ blockscoutClient: new BlockscoutClient('fixture-key') }).evaluateTransaction(native);
  assert.equal(result.decision, 'BLOCK');
  await new Promise(resolve => setTimeout(resolve, 550));
  assert.equal(calls, 1);
});
