import { createHash, randomUUID } from 'crypto';
import { AuditReceipt, GuardDecision, TransactionCandidate, SecurityCheckResult } from '../types/index.js';

export class ReceiptSigner {
  private policyVersion: string = 'v1.2.0-blockscout-pro';

  /**
   * Generates a tamper-evident audit receipt with cryptographic hash and Blockscout explorer links
   */
  public generateReceipt(
    tx: TransactionCandidate,
    decision: GuardDecision,
    riskScore: number,
    checks: SecurityCheckResult[],
    blockscoutExplorerUrl: string
  ): AuditReceipt {
    const timestamp = Date.now();
    const isoDate = new Date(timestamp).toISOString();
    const receiptId = `rcpt_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    // Build canonical integrity string for hashing
    const canonicalPayload = JSON.stringify({
      receiptId,
      timestamp,
      policyVersion: this.policyVersion,
      decision,
      riskScore,
      tx: {
        from: tx.from.toLowerCase(),
        to: tx.to.toLowerCase(),
        value: tx.value,
        chainId: tx.chainId,
        tokenAddress: tx.tokenAddress?.toLowerCase(),
        transactionTo: tx.transactionTo?.toLowerCase(),
        transactionValue: tx.transactionValue,
        rawAmount: tx.rawAmount,
        data: tx.data?.toLowerCase()
      },
      checks: checks.map(c => ({ id: c.id, status: c.status, score: c.scoreImpact }))
    });

    const integrityHash = createHash('sha256').update(canonicalPayload).digest('hex');

    return {
      receiptId,
      timestamp,
      isoDate,
      decision,
      riskScore,
      agentId: tx.agentId || 'default-agent',
      transactionSummary: {
        from: tx.from,
        to: tx.to,
        value: tx.value,
        chainId: tx.chainId,
        asset: tx.tokenAddress ? 'USDC' : 'NATIVE',
        tokenAddress: tx.tokenAddress,
        transactionTo: tx.transactionTo,
        transactionValue: tx.transactionValue,
        rawAmount: tx.rawAmount,
        data: tx.data
      },
      integrityHash: `0x${integrityHash}`,
      blockscoutExplorerUrl
    };
  }
}
