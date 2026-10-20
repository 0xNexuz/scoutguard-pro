import { BlockscoutClient, SUPPORTED_CHAINS } from './blockscout-client.js';
import { PoisoningDetector } from './poisoning-detector.js';
import { ContractVerificationGate } from './contract-gate.js';
import { PolicyEngine } from './policy-engine.js';
import { ReceiptSigner } from './receipt-signer.js';
import { isAddress } from 'ethers';
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
    blockscoutClient?: BlockscoutClient;
  }) {
    this.blockscout = options?.blockscoutClient || new BlockscoutClient(options?.apiKey);
    this.poisoningDetector = new PoisoningDetector();
    this.contractGate = new ContractVerificationGate();
    this.policyEngine = new PolicyEngine();
    this.receiptSigner = new ReceiptSigner();

    this.knownCounterparties = options?.customCounterparties ?? [];
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
    const valid = isAddress(tx.to) && isAddress(tx.from) &&
      typeof tx.value === 'string' && /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(tx.value) &&
      Number.isFinite(Number(tx.value)) && Number.isSafeInteger(tx.chainId) &&
      !tx.tokenAddress && !tx.data;
    const explorerUrl = valid && SUPPORTED_CHAINS[tx.chainId]
      ? this.blockscout.getExplorerAddressUrl(tx.chainId, tx.to) : '';

    try {
      if (!valid || !SUPPORTED_CHAINS[tx.chainId]) throw new Error('Invalid transaction candidate or unsupported chain');
      // A missing upstream response must never be interpreted as clean history.
      const [counters, details] = await Promise.all([
        this.blockscout.getAddressCounters(tx.chainId, tx.to),
        this.blockscout.getAddressDetails(tx.chainId, tx.to)
      ]);
      const contractSecurity = details.isContract
        ? await this.blockscout.getContractSecurity(tx.chainId, tx.to)
        : { isContract: false, isVerified: false };

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
