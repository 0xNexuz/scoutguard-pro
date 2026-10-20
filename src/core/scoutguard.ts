import { BlockscoutClient } from './blockscout-client.js';
import { PoisoningDetector } from './poisoning-detector.js';
import { ContractVerificationGate } from './contract-gate.js';
import { PolicyEngine } from './policy-engine.js';
import { ReceiptSigner } from './receipt-signer.js';
import {
  TransactionCandidate,
  EvaluationResult,
  KnownCounterparty,
  SecurityCheckResult
} from '../types/index.js';

export class ScoutGuard {
  private blockscout: BlockscoutClient;
  private poisoningDetector: PoisoningDetector;
  private contractGate: ContractVerificationGate;
  private policyEngine: PolicyEngine;
  private receiptSigner: ReceiptSigner;
  private knownCounterparties: KnownCounterparty[];

  constructor(options?: {
    apiKey?: string;
    customCounterparties?: KnownCounterparty[];
  }) {
    this.blockscout = new BlockscoutClient(options?.apiKey);
    this.poisoningDetector = new PoisoningDetector();
    this.contractGate = new ContractVerificationGate();
    this.policyEngine = new PolicyEngine();
    this.receiptSigner = new ReceiptSigner();

    // Default registered legitimate counterparties
    this.knownCounterparties = options?.customCounterparties || [
      {
        address: '0xd9A100913988f5CDbC328E07b8e5c14a60153a91',
        name: 'Acme Cloud Compute & Hardware',
        category: 'VENDOR',
        verifiedSince: '2024-03-15',
        totalTransfers: 142
      },
      {
        address: '0x1111111254fb6c44bac0bed2854e76f90643097d',
        name: '1inch Aggregator Router v5',
        category: 'CONTRACT',
        verifiedSince: '2022-11-10',
        totalTransfers: 184500
      },
      {
        address: '0x283Af0B28c62C092C9727F1Ee09c02CA627EB7F5',
        name: 'ENS Registrar Controller',
        category: 'CONTRACT',
        verifiedSince: '2020-05-04',
        totalTransfers: 920400
      },
      {
        address: '0x4200000000000000000000000000000000000006',
        name: 'Base WETH Deposit Bridge',
        category: 'TREASURY',
        verifiedSince: '2023-08-01',
        totalTransfers: 3500000
      }
    ];
  }

  public getKnownCounterparties(): KnownCounterparty[] {
    return [...this.knownCounterparties];
  }

  public registerCounterparty(counterparty: KnownCounterparty): void {
    this.knownCounterparties.push(counterparty);
  }

  /**
   * Main evaluation entrypoint: Evaluates an agent's pre-flight transaction against all security layers
   */
  public async evaluateTransaction(tx: TransactionCandidate): Promise<EvaluationResult> {
    const checks: SecurityCheckResult[] = [];
    const explorerUrl = this.blockscout.getExplorerAddressUrl(tx.chainId, tx.to);

    try {
      // 1. Fetch live or fallback data from Blockscout PRO API
      const [counters, details, contractSecurity] = await Promise.all([
        this.blockscout.getAddressCounters(tx.chainId, tx.to),
        this.blockscout.getAddressDetails(tx.chainId, tx.to),
        this.blockscout.getContractSecurity(tx.chainId, tx.to)
      ]);

      // 2. Check 1: Address Poisoning & Vanity Collision
      const poisoningCheck = this.poisoningDetector.evaluatePoisoningRisk(
        tx.to,
        counters,
        this.knownCounterparties,
        explorerUrl
      );
      checks.push(poisoningCheck);

      // 3. Check 2: Contract Verification, Bytecode, & Scam Flags
      const contractCheck = this.contractGate.evaluateContractSecurity(
        tx.to,
        counters.isContract || details.isContract,
        contractSecurity,
        details,
        explorerUrl
      );
      checks.push(contractCheck);

      // 4. Check 3: Spending Cap & Agent Policy
      const policyCheck = this.policyEngine.evaluatePolicy(tx, explorerUrl);
      checks.push(policyCheck);

      // 5. Synthesize decisions
      const synthesized = this.policyEngine.synthesizeDecision(checks);

      // 6. Generate cryptographic audit receipt
      const receipt = this.receiptSigner.generateReceipt(
        tx,
        synthesized.decision,
        synthesized.riskScore,
        checks,
        explorerUrl
      );

      return {
        decision: synthesized.decision,
        riskScore: synthesized.riskScore,
        reasons: synthesized.reasons,
        checks,
        receipt,
        suggestedAction: synthesized.suggestedAction,
        executionAllowed: synthesized.executionAllowed
      };
    } catch (err) {
      // Fail-closed security guarantee
      const errorMsg = err instanceof Error ? err.message : String(err);
      const failClosedCheck: SecurityCheckResult = {
        id: 'SEC-FAIL-CLOSED',
        name: 'Fail-Closed Security Interceptor',
        status: 'FAIL',
        scoreImpact: 100,
        detail: `Security engine encountered an unexpected error: ${errorMsg}. Halting transaction fail-closed.`,
        evidenceUrl: explorerUrl
      };

      const receipt = this.receiptSigner.generateReceipt(
        tx,
        'BLOCK',
        100,
        [failClosedCheck],
        explorerUrl
      );

      return {
        decision: 'BLOCK',
        riskScore: 100,
        reasons: [`FAIL-CLOSED: System aborted transaction for security safety. (${errorMsg})`],
        checks: [failClosedCheck],
        receipt,
        suggestedAction: 'ABORT_TRANSACTION',
        executionAllowed: false
      };
    }
  }
}
