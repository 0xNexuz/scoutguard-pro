import { createHash, randomUUID } from 'crypto';
import { AuditReceipt, GuardDecision, TransactionCandidate, SecurityCheckResult, HistoryCoverage } from '../types/index.js';

/** Stable key order, including nested evidence metadata. Arrays preserve their order. */
function canonicalize(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
    .filter(key => value[key] !== undefined).map(key => [key, canonicalize(value[key])]));
  return value;
}
export function canonicalSerialize(value: unknown): string { return JSON.stringify(canonicalize(value)); }

export function paymentSummary(tx: TransactionCandidate): AuditReceipt['transactionSummary'] {
  return { from: tx.from, to: tx.to, value: tx.value, chainId: tx.chainId,
    asset: tx.tokenAddress ? 'USDC' : 'NATIVE', tokenAddress: tx.tokenAddress,
    transactionTo: tx.transactionTo, transactionValue: tx.transactionValue, rawAmount: tx.rawAmount, data: tx.data };
}

function digest(receipt: Omit<AuditReceipt, 'integrityHash'> | AuditReceipt): string {
  const { integrityHash: _ignored, ...payload } = receipt as AuditReceipt;
  return `0x${createHash('sha256').update(canonicalSerialize(payload)).digest('hex')}`;
}

// Retains the original class name for compatibility. This is NOT an authenticated signature.
export class ReceiptSigner {
  public generateReceipt(tx: TransactionCandidate, decision: GuardDecision, riskScore: number,
    checks: SecurityCheckResult[], blockscoutExplorerUrl: string, historyCoverage?: HistoryCoverage): AuditReceipt {
    const timestamp = Date.now();
    const receipt = {
      receiptId: `rcpt_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      timestamp, isoDate: new Date(timestamp).toISOString(), decision, riskScore,
      agentId: tx.agentId || 'procurement-bot-01',
      policyVersion: 'v1.3.0-sprint2-hardening', integrityAlgorithm: 'SHA-256-UNKEYED' as const,
      transactionSummary: paymentSummary(tx),
      checks: structuredClone(checks), historyCoverage: historyCoverage && structuredClone(historyCoverage), blockscoutExplorerUrl
    };
    return { ...receipt, integrityHash: digest(receipt) };
  }

  /** Detects changes relative to the supplied digest; an attacker can recompute an unkeyed digest. */
  public verifyReceipt(receipt: AuditReceipt): boolean {
    try {
      return receipt.integrityAlgorithm === 'SHA-256-UNKEYED'
        && receipt.policyVersion === 'v1.3.0-sprint2-hardening'
        && Array.isArray(receipt.checks) && new Date(receipt.timestamp).toISOString() === receipt.isoDate
        && digest(receipt) === receipt.integrityHash;
    } catch { return false; }
  }
}
