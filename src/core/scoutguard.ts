import { BlockscoutClient } from './blockscout-client.js';
import { PoisoningDetector } from './poisoning-detector.js';
import { ContractVerificationGate } from './contract-gate.js';
import { PolicyEngine } from './policy-engine.js';
import { ReceiptSigner } from './receipt-signer.js';
import { normalizePayment } from './payment-normalizer.js';
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
    let explorerUrl = '';

    try {
      const payment = normalizePayment(tx);
      const token = payment.tokenAddress ? this.blockscout.getTokenConfig(payment.chainId, payment.tokenAddress) : undefined;
      explorerUrl = this.blockscout.getExplorerAddressUrl(payment.chainId, payment.to);
      // A missing upstream response must never be interpreted as clean history.
      const [counters, details, historyCounterparties] = await Promise.all([
        this.blockscout.getAddressCounters(payment.chainId, payment.to),
        this.blockscout.getAddressDetails(payment.chainId, payment.to),
        this.blockscout.getSenderCounterparties(payment.chainId, payment.from)
      ]);
      const counterparties = new Map(historyCounterparties.map(counterparty => [counterparty.address.toLowerCase(), counterparty]));
      for (const counterparty of this.knownCounterparties) {
        counterparties.set(counterparty.address.toLowerCase(), { ...counterparty, source: counterparty.source || 'CONFIGURED' });
      }
      const contractSecurity = details.isContract
        ? await this.blockscout.getContractSecurity(payment.chainId, payment.to)
        : { isContract: false, isVerified: false };

      // 2. Check 1: Address Poisoning & Vanity Collision
      const poisoningCheck = this.poisoningDetector.evaluatePoisoningRisk(
        payment.to,
        counters,
        [...counterparties.values()],
        explorerUrl
      );
      poisoningCheck.metadata = {
        ...poisoningCheck.metadata,
        comparisonSource: 'BLOCKSCOUT_SENDER_HISTORY',
        counterpartiesCompared: counterparties.size
      };
      const matchedAddress = poisoningCheck.metadata.vendorAddress as string | undefined;
      const matchedCounterparty = matchedAddress ? counterparties.get(matchedAddress.toLowerCase()) : counterparties.get(payment.to.toLowerCase());
      if (matchedCounterparty?.source === 'BLOCKSCOUT_HISTORY' && matchedCounterparty.evidenceTxHash) {
        poisoningCheck.metadata.observedTransactionUrl = this.blockscout.getExplorerTxUrl(payment.chainId, matchedCounterparty.evidenceTxHash);
      }
      checks.push(poisoningCheck);

      // 3. Check 2: Contract Verification, Bytecode, & Scam Flags
      const contractCheck = this.contractGate.evaluateContractSecurity(
        payment.to,
        counters.isContract || details.isContract,
        contractSecurity,
        details,
        explorerUrl
      );
      checks.push(contractCheck);

      if (token) {
        const tokenExplorerUrl = this.blockscout.getExplorerAddressUrl(payment.chainId, token.address);
        const tokenSecurity = await this.blockscout.getContractSecurity(payment.chainId, token.address);
        checks.push({
          id: tokenSecurity.isVerified ? 'SEC-TOKEN-USDC' : 'SEC-TOKEN-UNVERIFIED',
          name: 'Supported Stablecoin Contract',
          status: tokenSecurity.isVerified ? 'PASS' : 'FAIL',
          scoreImpact: tokenSecurity.isVerified ? 0 : 100,
          detail: tokenSecurity.isVerified
            ? `${token.name} (${token.symbol}) matched the canonical allowlisted contract and is source-verified on Blockscout.`
            : `${token.name} matched the allowlist, but Blockscout did not return verified source metadata.`,
          evidenceUrl: tokenExplorerUrl,
          metadata: { symbol: token.symbol, decimals: token.decimals, tokenAddress: token.address }
        });
      }

      // 4. Check 3: Spending Cap & Agent Policy
      const policyCheck = this.policyEngine.evaluatePolicy(payment, explorerUrl, token);
      checks.push(policyCheck);

      // 5. Synthesize decisions
      const synthesized = this.policyEngine.synthesizeDecision(checks);

      // 6. Generate cryptographic audit receipt
      const receipt = this.receiptSigner.generateReceipt(
        payment,
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
