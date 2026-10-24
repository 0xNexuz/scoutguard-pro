// Synthetic values in Blockscout API v2 shapes; these are not live observations.
import { BlockscoutClient } from '../../src/core/blockscout-client.js';
import { HistoryCoverage, SenderHistory } from '../../src/types/index.js';
export const sender = `0x${'1'.repeat(40)}`;
export const recipient = `0x${'2'.repeat(40)}`;
export const olderRecipient = `0x${'3'.repeat(40)}`;
export const usdc = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
export const txHash = (n = 1) => `0x${n.toString(16).padStart(64, '0')}`;
export const nativeRow = (overrides: Record<string, unknown> = {}) => ({
  from: { hash: sender, is_contract: false }, to: { hash: recipient, is_contract: false },
  hash: txHash(), value: '100000000000000000', status: 'ok', block_number: 21000000,
  timestamp: '2024-10-23T00:00:00.000000Z', ...overrides
});
export const tokenRow = (overrides: Record<string, unknown> = {}) => ({
  from: { hash: sender }, to: { hash: recipient }, transaction_hash: txHash(2),
  total: { value: '250000000', decimals: '6' }, token: { address_hash: usdc, type: 'ERC-20', symbol: 'USDC' },
  log_index: 3, block_number: 21000000, timestamp: '2024-10-23T00:00:00.000000Z', ...overrides
});
export const page = (items: unknown[] = [], next_page_params: unknown = null) => ({ items, next_page_params });
export const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status });
export function completeHistory(overrides: Partial<HistoryCoverage> = {}): SenderHistory {
  return { counterparties: [], evidence: [], coverage: { chainId: 1, sender,
    pagesScanned: { transactions: 1, tokenTransfers: 1 }, recordsInspected: 0, uniqueCounterparties: 0,
    outgoingNativeTransfers: 0, outgoingTokenTransfers: 0, duplicatesSkipped: 0, incomingOnlyAddresses: 0,
    zeroValueInteractions: 0, paginationComplete: true, truncated: false, stopReasons: [], timeBudgetExhausted: false,
    requestBudgetExhausted: false, providerCalls: 2, providerErrors: [], fetchedAt: '2026-10-24T00:00:00Z',
    limits: { maxPages: 3, maxRecords: 300, maxProviderCalls: 8, maxDurationMs: 10000 }, ...overrides } };
}
export function fixtureClient(history = completeHistory()): BlockscoutClient {
  return Object.assign(new BlockscoutClient('fixture-key'), {
    getAddressCounters: async () => ({ transactionsCount: 142, tokenTransfersCount: 25, gasUsageCount: 0, isContract: false }),
    getAddressDetails: async () => ({ isContract: false, isScamOrPhishing: false, tags: [], reputationScore: 60 }),
    getSenderHistory: async () => history,
    getContractSecurity: async () => ({ isContract: true, isVerified: true, contractName: 'USD Coin' })
  });
}
