import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PoisoningDetector } from '../src/core/poisoning-detector.js';
import { ContractVerificationGate } from '../src/core/contract-gate.js';
import { PolicyEngine } from '../src/core/policy-engine.js';
import { ReceiptSigner } from '../src/core/receipt-signer.js';
import { ScoutGuard } from '../src/core/scoutguard.js';
import { KnownCounterparty, TransactionCandidate } from '../src/types/index.js';

describe('ScoutGuard PRO — Automated Security Test Suite', () => {

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
    const guard = new ScoutGuard();

    it('INVARIANT 1: Address poisoning attack MUST be intercepted and BLOCKED', async () => {
      const poisonTx: TransactionCandidate = {
        from: '0xAgent',
        to: '0xd9A1846b801a2E3cD49e917A00bB9e22e9283a91', // Spoofed look-alike
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
        from: '0xAgent',
        to: '0xd9A100913988f5CDbC328E07b8e5c14a60153a91', // Exact authentic Acme Cloud
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
  });

});
