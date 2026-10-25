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

/** Public, bounded metadata about actual upstream requests. No URL or credential is retained. */
export interface ProviderRequestTrace {
  evaluationId: string;
  chainId: number;
  endpoint: 'ADDRESS_COUNTERS' | 'ADDRESS_DETAILS' | 'SENDER_TRANSACTIONS' | 'SENDER_TOKEN_TRANSFERS' | 'SMART_CONTRACT';
  source: 'BLOCKSCOUT_PRO' | 'BLOCKSCOUT_PUBLIC_API';
  httpStatus?: number;
  durationMs: number;
  timestamp: string;
  recordCount?: number;
  hasNextPage?: boolean;
  page?: number;
  errorCategory?: string;
}

export interface ProviderObservations {
  recipientCounters: AddressCounterData;
  recipientDetails: { isContract: boolean; isScamOrPhishing: boolean; name?: string; tags: string[] };
  recipientContract?: ContractSecurityData;
  tokenContract?: ContractSecurityData;
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
  policyVersion: string;
  checks: SecurityCheckResult[];
  historyCoverage?: HistoryCoverage;
  providerTrace?: ProviderRequestTrace[];
  providerObservations?: ProviderObservations;
  integrityAlgorithm: 'SHA-256-UNKEYED';
  integrityHash: string;
  blockscoutExplorerUrl: string;
}

export interface EvaluationResult {
  history?: SenderHistory;
  providerTrace?: ProviderRequestTrace[];
  providerObservations?: ProviderObservations;
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
  chainId?: number; // configured entries without a chain apply to all configured chains
  relationship?: 'OUTBOUND_NATIVE' | 'OUTBOUND_ERC20';
  evidenceTxHash?: string; // observed outbound transaction, never the proposed payment
}

export interface HistoryLimits {
  maxPages: number; // per endpoint
  maxRecords: number; // combined inspected rows, including duplicates
  maxProviderCalls: number; // history only; evaluation also has an overall budget
  maxDurationMs: number;
  maxAgeDays?: number;
}

export interface HistoryCoverage {
  chainId: number;
  sender: string;
  pagesScanned: { transactions: number; tokenTransfers: number };
  recordsInspected: number;
  uniqueCounterparties: number;
  outgoingNativeTransfers: number;
  outgoingTokenTransfers: number;
  duplicatesSkipped: number;
  incomingOnlyAddresses: number;
  zeroValueInteractions: number;
  paginationComplete: boolean;
  truncated: boolean;
  stopReasons: string[];
  timeBudgetExhausted: boolean;
  requestBudgetExhausted: boolean;
  providerCalls: number;
  providerErrors: { endpoint: string; code: string }[];
  fetchedAt: string;
  oldestEvidenceAt?: string;
  newestEvidenceAt?: string;
  limits: HistoryLimits;
}

export interface CounterpartyEvidence {
  chainId: number;
  address: string;
  relationship: 'OUTBOUND_NATIVE' | 'OUTBOUND_ERC20' | 'INCOMING_ONLY' | 'INCOMING' | 'ZERO_VALUE' | 'INCOMPLETE';
  direction: 'OUTGOING' | 'INCOMING' | 'SELF';
  transactionHash: string;
  timestamp?: string;
  blockNumber?: number;
  rawAmount: string;
  tokenAddress?: string;
  logIndex?: number;
  // Token event sender is not necessarily the transaction initiator.
  initiatorVerified: boolean;
}

export interface SenderHistory {
  counterparties: KnownCounterparty[];
  evidence: CounterpartyEvidence[];
  coverage: HistoryCoverage;
}
