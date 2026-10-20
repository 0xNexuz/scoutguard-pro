export type GuardDecision = 'PASS' | 'FLAG' | 'BLOCK';

export interface TransactionCandidate {
  from: string;
  to: string;
  value: string; // in native units or token wei
  chainId: number;
  data?: string;
  tokenAddress?: string;
  agentId?: string;
  memo?: string;
}

export interface SecurityCheckResult {
  id: string;
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  scoreImpact: number;
  detail: string;
  evidenceUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditReceipt {
  receiptId: string;
  timestamp: number;
  isoDate: string;
  decision: GuardDecision;
  riskScore: number;
  agentId: string;
  transactionSummary: {
    from: string;
    to: string;
    value: string;
    chainId: number;
  };
  integrityHash: string;
  blockscoutExplorerUrl: string;
}

export interface EvaluationResult {
  decision: GuardDecision;
  riskScore: number; // 0 to 100 (0 = clean, 100 = critical threat)
  reasons: string[];
  checks: SecurityCheckResult[];
  receipt: AuditReceipt;
  suggestedAction: 'SIGN_AND_BROADCAST' | 'QUARANTINE_FOR_APPROVAL' | 'ABORT_TRANSACTION';
  executionAllowed: boolean;
}

export interface AddressCounterData {
  transactionsCount: number;
  tokenTransfersCount: number;
  gasUsageCount: number;
  isContract: boolean;
}

export interface ContractSecurityData {
  isContract: boolean;
  isVerified: boolean;
  contractName?: string;
  hasProxyPattern?: boolean;
  isScamOrPhishing?: boolean;
  tags?: string[];
}

export interface KnownCounterparty {
  address: string;
  name: string;
  category: 'VENDOR' | 'EXCHANGE' | 'TREASURY' | 'CONTRACT';
  verifiedSince: string;
  totalTransfers: number;
}
