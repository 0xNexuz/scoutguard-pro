import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PoisoningDetector } from '../src/core/poisoning-detector.js';
import { ContractVerificationGate } from '../src/core/contract-gate.js';
import { PolicyEngine } from '../src/core/policy-engine.js';
import { ReceiptSigner } from '../src/core/receipt-signer.js';
import { ScoutGuard } from '../src/core/scoutguard.js';
import { BlockscoutClient } from '../src/core/blockscout-client.js';
import { KnownCounterparty, TransactionCandidate } from '../src/types/index.js';
import { Interface, parseUnits } from 'ethers';
import { normalizePayment } from '../src/core/payment-normalizer.js';

const usdc = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const transfer = new Interface(['function transfer(address,uint256)']);

describe('ScoutGuard PRO — Automated Security Test Suite', () => {

  it('routes authenticated PRO requests through the selected chain ID', () => {
    const client = new BlockscoutClient('test-key');
    const url = (client as any).v2Url(8453, 'addresses/0x0000000000000000000000000000000000000000');
    assert.ok(url.startsWith('https://api.blockscout.com/8453/api/v2/addresses/'));
    assert.strictEqual(new URL(url).searchParams.get('apikey'), 'test-key');
  });

  it('derives only positive outbound payments from sender history', async () => {
    const sender = '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be';
    const recipient = '0x3f8702cfb1662195fcc98593789682da91dfaae3';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const token = String(input).includes('token-transfers');
      return new Response(JSON.stringify({ items: token ? [
        { from: { hash: recipient }, to: { hash: sender }, total: { value: '100' } },
        { from: { hash: sender }, to: { hash: recipient }, total: { value: '0' } },
        { from: { hash: sender }, to: { hash: recipient }, total: { value: '250000000' },
          transaction_hash: `0x${'a'.repeat(64)}` }
      ] : [
        { from: { hash: sender }, to: { hash: '0x1111111111111111111111111111111111111111' }, value: '0' }
      ] }), { status: 200 });
    };
    try {
      const entries = await new BlockscoutClient().getSenderCounterparties(1, sender);
      assert.strictEqual(entries.length, 1);
      assert.strictEqual(entries[0].address, recipient);
      assert.strictEqual(entries[0].totalTransfers, 1);
      assert.strictEqual(entries[0].evidenceTxHash, `0x${'a'.repeat(64)}`);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  const knownVendor: KnownCounterparty = {
    address: '0xd9A100913988f5CDbC328E07b8e5c14a60153a91',
    name: 'Acme Cloud Compute',
    category: 'VENDOR',
    verifiedSince: '2024-01-01',
    totalTransfers: 100
  };

  describe('1. PoisoningDetector — Vanity Collision Algorithm', () => {
    const detector = new PoisoningDetector();

    it('should identify legitimate vendor exact match as CLEAN', () => {
      const result = detector.detectVanityCollision(knownVendor.address, [knownVendor]);
      assert.strictEqual(result.isPoisoningCandidate, false);
      assert.strictEqual(result.severity, 'CLEAN');
      assert.strictEqual(result.matchedVendor?.name, 'Acme Cloud Compute');
    });

    it('should detect and flag vanity look-alike address as CRITICAL', () => {
      // Look-alike matching '0xd9A1' and '3a91' but different in between
      const poisonAddress = '0xd9A1999999999999999999999999999999993a91';
      const result = detector.detectVanityCollision(poisonAddress, [knownVendor]);
      assert.strictEqual(result.isPoisoningCandidate, true);
      assert.strictEqual(result.severity, 'CRITICAL');
      assert.ok(result.prefixMatchLength >= 4);
      assert.ok(result.suffixMatchLength >= 4);
    });

    it('replays a published Poison-Hunter case as a critical look-alike when its reference is available', () => {
      const reference = { ...knownVendor, address: '0xcb9da91c741820157e81ae21cddd5d207997b1b6' };
      const result = detector.detectVanityCollision('0xcb9d34bbb0480e714f4c004cfd8cb72b776db1b6', [reference]);
      assert.strictEqual(result.severity, 'CRITICAL');
      assert.strictEqual(result.prefixMatchLength, 4);
      assert.strictEqual(result.suffixMatchLength, 4);
    });

    it('should return CLEAN for completely unrelated addresses', () => {
      const randomAddress = '0x1234567890123456789012345678901234567890';
      const result = detector.detectVanityCollision(randomAddress, [knownVendor]);
      assert.strictEqual(result.isPoisoningCandidate, false);
      assert.strictEqual(result.severity, 'CLEAN');
    });
  });

  describe('2. ContractVerificationGate — Bytecode & Phishing Defense', () => {
    const gate = new ContractVerificationGate();
    const testUrl = 'https://eth.blockscout.com/address/0x123';

    it('should instantly FAIL addresses flagged on Blockscout threat feed', () => {
      const result = gate.evaluateContractSecurity(
        '0xBadActor',
        false,
        { isContract: false, isVerified: false },
        { isScamOrPhishing: true, tags: ['Scam', 'Drainer'], reputationScore: 0 },
        testUrl
      );
      assert.strictEqual(result.status, 'FAIL');
      assert.strictEqual(result.scoreImpact, 100);
      assert.ok(result.detail.includes('phishing'));
    });

    it('should PASS clean Externally Owned Accounts (EOA)', () => {
      const result = gate.evaluateContractSecurity(
        '0xGoodUser',
        false,
        { isContract: false, isVerified: false },
        { isScamOrPhishing: false, tags: [], reputationScore: 90 },
        testUrl
      );
      assert.strictEqual(result.status, 'PASS');
      assert.strictEqual(result.scoreImpact, 0);
    });

    it('should WARN when interacting with unverified contract bytecode', () => {
      const result = gate.evaluateContractSecurity(
        '0xUnverifiedContract',
        true,
        { isContract: true, isVerified: false },
        { isScamOrPhishing: false, tags: [], reputationScore: 50 },
        testUrl
      );
      assert.strictEqual(result.status, 'WARN');
      assert.strictEqual(result.scoreImpact, 45);
    });

    it('should PASS verified open-source smart contracts', () => {
      const result = gate.evaluateContractSecurity(
        '0xVerifiedRouter',
        true,
        { isContract: true, isVerified: true, contractName: 'UniswapV3Router' },
        { isScamOrPhishing: false, tags: [], reputationScore: 95 },
        testUrl
      );
      assert.strictEqual(result.status, 'PASS');
      assert.strictEqual(result.scoreImpact, 0);
    });
  });

  describe('3. PolicyEngine — Deterministic Spending Limits & Tri-State Decisions', () => {
    const policyEngine = new PolicyEngine();
    const testUrl = 'https://base.blockscout.com';

    it('should PASS transactions within autonomous spending caps', () => {
      const tx: TransactionCandidate = {
        from: '0xAgent',
        to: '0xRecipient',
        value: '0.75', // under 1.0 human threshold, under 2.5 cap
        chainId: 8453,
        agentId: 'procurement-bot-01'
      };
      const result = policyEngine.evaluatePolicy(tx, testUrl);
      assert.strictEqual(result.status, 'PASS');
    });

    it('should FAIL transactions exceeding maximum hard cap', () => {
      const tx: TransactionCandidate = {
        from: '0xAgent',
        to: '0xRecipient',
        value: '10.0', // exceeds 2.5 ETH limit
        chainId: 8453,
        agentId: 'procurement-bot-01'
      };
      const result = policyEngine.evaluatePolicy(tx, testUrl);
      assert.strictEqual(result.status, 'FAIL');
      assert.strictEqual(result.scoreImpact, 75);
    });

    it('should WARN and quarantine high-value payments requiring human sign-off', () => {
      const tx: TransactionCandidate = {
        from: '0xAgent',
        to: '0xRecipient',
        value: '1.8', // between 1.0 and 2.5
        chainId: 8453,
        agentId: 'procurement-bot-01'
      };
      const result = policyEngine.evaluatePolicy(tx, testUrl);
      assert.strictEqual(result.status, 'WARN');
      assert.strictEqual(result.scoreImpact, 30);
    });
  });

  describe('4. ReceiptSigner — Integrity Hashing', () => {
    const signer = new ReceiptSigner();
    it('should create valid SHA-256 cryptographic receipt with Blockscout URL', () => {
      const tx: TransactionCandidate = {
        from: '0xAgent',
        to: '0xRecipient',
        value: '1.0',
        chainId: 8453
      };
      const receipt = signer.generateReceipt(tx, 'PASS', 0, [], 'https://base.blockscout.com/address/0xRecipient');
      assert.ok(receipt.receiptId.startsWith('rcpt_'));
      assert.ok(receipt.integrityHash.startsWith('0x'));
      assert.strictEqual(receipt.integrityHash.length, 66); // 0x + 64 hex chars
      assert.strictEqual(receipt.decision, 'PASS');
      assert.strictEqual(receipt.blockscoutExplorerUrl, 'https://base.blockscout.com/address/0xRecipient');
    });
  });

  describe('5. ScoutGuard Orchestrator — End-to-End Invariants', () => {
    const fixtureClient = Object.assign(new BlockscoutClient(), {
      getAddressCounters: async () => ({ transactionsCount: 142, tokenTransfersCount: 25, gasUsageCount: 0, isContract: false }),
      getAddressDetails: async () => ({ isContract: false, isScamOrPhishing: false, tags: [], reputationScore: 60 }),
      getSenderCounterparties: async () => [],
      getContractSecurity: async () => ({ isContract: true, isVerified: true, contractName: 'USD Coin' })
    });
    const guard = new ScoutGuard({ blockscoutClient: fixtureClient, customCounterparties: [knownVendor] });

    it('INVARIANT 1: Address poisoning attack MUST be intercepted and BLOCKED', async () => {
      const poisonTx: TransactionCandidate = {
        from: '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
        to: '0xd9a1846b801a2e3cd49e917a00bb9e22e9283a91', // Spoofed look-alike
        value: '0.5',
        chainId: 8453,
        agentId: 'procurement-bot-01'
      };

      const result = await guard.evaluateTransaction(poisonTx);
      assert.strictEqual(result.decision, 'BLOCK');
      assert.strictEqual(result.executionAllowed, false);
      assert.strictEqual(result.suggestedAction, 'ABORT_TRANSACTION');
      assert.ok(result.riskScore >= 60);
      assert.ok(result.checks.some(c => c.id.startsWith('SEC-POISON')));
    });

    it('INVARIANT 2: Legitimate vendor payment MUST PASS with executionAllowed=true', async () => {
      const validTx: TransactionCandidate = {
        from: '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
        to: '0xd9a100913988f5cdbc328e07b8e5c14a60153a91', // Exact demo vendor
        value: '0.5',
        chainId: 8453,
        agentId: 'procurement-bot-01'
      };

      const result = await guard.evaluateTransaction(validTx);
      assert.strictEqual(result.decision, 'PASS');
      assert.strictEqual(result.executionAllowed, true);
      assert.strictEqual(result.suggestedAction, 'SIGN_AND_BROADCAST');
      assert.strictEqual(result.riskScore, 0);
    });

    it('INVARIANT 3: unavailable Blockscout data MUST BLOCK', async () => {
      const unavailable = Object.assign(new BlockscoutClient(), {
        getAddressCounters: async () => { throw new Error('upstream unavailable'); },
        getAddressDetails: async () => ({ isContract: false, isScamOrPhishing: false, tags: [], reputationScore: 60 }),
        getSenderCounterparties: async () => []
      });
      const result = await new ScoutGuard({ blockscoutClient: unavailable }).evaluateTransaction({
        from: '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
        to: knownVendor.address.toLowerCase(), value: '0.5', chainId: 8453
      });
      assert.strictEqual(result.decision, 'BLOCK');
      assert.strictEqual(result.executionAllowed, false);
      assert.strictEqual(result.checks[0].id, 'SEC-FAIL-CLOSED');
    });

    it('INVARIANT 4: unsupported transaction calldata MUST NOT PASS', async () => {
      const result = await guard.evaluateTransaction({
        from: '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
        to: knownVendor.address.toLowerCase(), value: '0.5', chainId: 8453, data: '0xabcdef'
      });
      assert.strictEqual(result.decision, 'BLOCK');
      assert.strictEqual(result.executionAllowed, false);
    });

    it('INVARIANT 5: unknown agent policy MUST NOT inherit a default policy', async () => {
      const result = await guard.evaluateTransaction({
        from: '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
        to: knownVendor.address.toLowerCase(), value: '0.5', chainId: 8453,
        agentId: 'unregistered-agent'
      });
      assert.strictEqual(result.decision, 'BLOCK');
      assert.strictEqual(result.executionAllowed, false);
    });

    it('INVARIANT 6: canonical USDC transfer uses token policy and Blockscout verification', async () => {
      const result = await guard.evaluateTransaction({
        from: '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
        to: usdc, value: '0', chainId: 1,
        data: transfer.encodeFunctionData('transfer', [knownVendor.address.toLowerCase(), parseUnits('250', 6)]),
        agentId: 'procurement-bot-01'
      });
      assert.strictEqual(result.decision, 'PASS');
      assert.strictEqual(result.executionAllowed, true);
      assert.ok(result.checks.some(check => check.id === 'SEC-TOKEN-USDC'));
      assert.strictEqual(result.receipt.transactionSummary.asset, 'USDC');
      assert.strictEqual(result.receipt.transactionSummary.to.toLowerCase(), knownVendor.address.toLowerCase());
      assert.strictEqual(result.receipt.transactionSummary.transactionTo?.toLowerCase(), usdc);
      assert.strictEqual(result.receipt.transactionSummary.rawAmount, '250000000');
    });

    it('INVARIANT 7: mismatched token metadata MUST NOT PASS', async () => {
      const result = await guard.evaluateTransaction({
        from: '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
        to: usdc, value: '0', chainId: 1,
        data: transfer.encodeFunctionData('transfer', [knownVendor.address.toLowerCase(), 1n]),
        tokenAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        agentId: 'procurement-bot-01'
      });
      assert.strictEqual(result.decision, 'BLOCK');
      assert.strictEqual(result.executionAllowed, false);
      assert.strictEqual(result.checks[0].id, 'SEC-FAIL-CLOSED');
    });

    it('rejects transferFrom and separate token assertions without calldata', () => {
      const base = { from: knownVendor.address.toLowerCase(), to: usdc, value: '0', chainId: 1 };
      assert.throws(() => normalizePayment({ ...base, data: '0x23b872dd' }), /Unsupported calldata/);
      assert.throws(() => normalizePayment({ ...base, tokenAddress: usdc }), /requires direct transfer calldata/);
    });

    it('handles exact smallest-unit USDC transfers and large raw integers', () => {
      const raw = 123456789012345678901234567890n;
      const tx = normalizePayment({ from: knownVendor.address.toLowerCase(), to: usdc, value: '0', chainId: 1,
        data: transfer.encodeFunctionData('transfer', [knownVendor.address.toLowerCase(), raw]) });
      assert.strictEqual(tx.rawAmount, raw.toString());
      assert.strictEqual(tx.value, '123456789012345678901234.56789');
      assert.strictEqual(normalizePayment({ from: knownVendor.address.toLowerCase(), to: usdc, value: '0', chainId: 1,
        data: transfer.encodeFunctionData('transfer', [knownVendor.address.toLowerCase(), 1n]) }).value, '0.000001');
    });

    it('INVARIANT 8: Blockscout sender history drives look-alike detection without configured counterparties', async () => {
      const historyClient = Object.assign(new BlockscoutClient(), {
        getAddressCounters: async () => ({ transactionsCount: 0, tokenTransfersCount: 0, gasUsageCount: 0, isContract: false }),
        getAddressDetails: async () => ({ isContract: false, isScamOrPhishing: false, tags: [], reputationScore: 60 }),
        getSenderCounterparties: async () => [{ ...knownVendor, source: 'BLOCKSCOUT_HISTORY' as const,
          evidenceTxHash: '0x72b14bf09379c0de3c621035fe341a5ae9726c0dd5732ea3e2096c8e232eee9f' }]
      });
      const result = await new ScoutGuard({ blockscoutClient: historyClient }).evaluateTransaction({
        from: '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be',
        to: '0xd9a1999999999999999999999999999999993a91', value: '0.5', chainId: 1,
        agentId: 'procurement-bot-01'
      });
      assert.strictEqual(result.decision, 'BLOCK');
      assert.ok(result.checks.some(check => check.id === 'SEC-POISON-01'));
      assert.strictEqual(result.checks[0].metadata?.comparisonSource, 'BLOCKSCOUT_SENDER_HISTORY');
      assert.strictEqual(result.checks[0].metadata?.observedTransactionUrl,
        'https://eth.blockscout.com/tx/0x72b14bf09379c0de3c621035fe341a5ae9726c0dd5732ea3e2096c8e232eee9f');
    });
  });

});
