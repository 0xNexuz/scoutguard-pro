export type GuardDecision = 'PASS' | 'FLAG' | 'BLOCK';

export interface TransactionCandidate {
  from: string;
  to: string;
  value: string; // decimal display units for the native asset or supported token
  chainId: number;
  data?: string;
  tokenAddress?: string;
  transactionTo?: string; // original unsigned transaction destination
  transactionValue?: string; // original unsigned native value
  rawAmount?: string; // exact payment amount in smallest asset units
  agentId?: string;
  memo?: string;
}

export interface TokenConfig {
  address: string;
  symbol: 'USDC';
  name: string;
  decimals: 6;
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
    asset: string;
    tokenAddress?: string;
    transactionTo?: string;
    transactionValue?: string;
    rawAmount?: string;
    data?: string;
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
  source?: 'CONFIGURED' | 'BLOCKSCOUT_HISTORY';
  evidenceTxHash?: string; // observed outbound transaction, never the proposed payment
}
