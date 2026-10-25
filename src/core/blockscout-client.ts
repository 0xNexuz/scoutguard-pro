import { AddressCounterData, ContractSecurityData, KnownCounterparty, TokenConfig, SenderHistory, HistoryLimits, CounterpartyEvidence, ProviderRequestTrace } from '../types/index.js';

import { ProviderBudget, ProviderError, createProviderBudget, requestJson } from './provider-budget.js';

export interface ChainConfig {
  chainId: number;
  name: string;
  baseUrl: string;
  apiUrl: string;
  currency: string;
}

export const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  1: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    baseUrl: 'https://eth.blockscout.com',
    apiUrl: 'https://eth.blockscout.com/api',
    currency: 'ETH'
  },
  8453: {
    chainId: 8453,
    name: 'Base',
    baseUrl: 'https://base.blockscout.com',
    apiUrl: 'https://base.blockscout.com/api',
    currency: 'ETH'
  },
  42161: {
    chainId: 42161,
    name: 'Arbitrum One',
    baseUrl: 'https://arbitrum.blockscout.com',
    apiUrl: 'https://arbitrum.blockscout.com/api',
    currency: 'ETH'
  },
  10: {
    chainId: 10,
    name: 'Optimism',
    baseUrl: 'https://optimism.blockscout.com',
    apiUrl: 'https://optimism.blockscout.com/api',
    currency: 'ETH'
  },
  42220: {
    chainId: 42220,
    name: 'Celo',
    baseUrl: 'https://celo.blockscout.com',
    apiUrl: 'https://celo.blockscout.com/api',
    currency: 'CELO'
  },
  137: {
    chainId: 137,
    name: 'Polygon',
    baseUrl: 'https://polygon.blockscout.com',
    apiUrl: 'https://polygon.blockscout.com/api',
    currency: 'POL'
  },
  11155111: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    baseUrl: 'https://eth-sepolia.blockscout.com',
    apiUrl: 'https://eth-sepolia.blockscout.com/api',
    currency: 'ETH'
  }
};

// Exact canonical USDC contracts. A caller cannot relabel an arbitrary ERC-20 as USDC.
export const SUPPORTED_TOKENS: Record<number, Record<string, TokenConfig>> = {
  1: {
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6
    }
  },
  8453: {
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': {
      address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6
    }
  }
};

export class HistoryUnavailableError extends ProviderError {
  constructor(public readonly history: SenderHistory) { super('CRITICAL_HISTORY_UNAVAILABLE'); }
}

export class BlockscoutClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.BLOCKSCOUT_API_KEY || '';
  }

  private v2Url(chainId: number, route: string): string {
    const chain = this.getChainConfig(chainId);
    const base = this.apiKey ? `https://api.blockscout.com/${chainId}` : chain.baseUrl;
    const url = new URL(`api/v2/${route}`, `${base}/`);
    if (this.apiKey) url.searchParams.set('apikey', this.apiKey);
    return url.toString();
  }

  private traceMetadata(chainId: number, endpoint: ProviderRequestTrace['endpoint'], page?: number) {
    return { chainId, endpoint, source: (this.apiKey ? 'BLOCKSCOUT_PRO' : 'BLOCKSCOUT_PUBLIC_API') as ProviderRequestTrace['source'], page };
  }

  private markSchemaError(budget: ProviderBudget, endpoint: ProviderRequestTrace['endpoint'], code: string): void {
    const request = [...budget.trace].reverse().find(entry => entry.endpoint === endpoint && entry.httpStatus === 200 && !entry.errorCategory);
    if (request) request.errorCategory = code;
  }

  public getChainConfig(chainId: number): ChainConfig {
    const chain = SUPPORTED_CHAINS[chainId];
    if (!chain) throw new Error(`Unsupported chain ID: ${chainId}`);
    return chain;
  }

  public getTokenConfig(chainId: number, tokenAddress: string): TokenConfig {
    const token = SUPPORTED_TOKENS[chainId]?.[tokenAddress.toLowerCase()];
    if (!token) throw new Error(`Unsupported token contract on Chain ID ${chainId}`);
    return token;
  }

  public getExplorerAddressUrl(chainId: number, address: string): string {
    const chain = this.getChainConfig(chainId);
    return `${chain.baseUrl}/address/${address}`;
  }

  public getExplorerTxUrl(chainId: number, txHash: string): string {
    const chain = this.getChainConfig(chainId);
    return `${chain.baseUrl}/tx/${txHash}`;
  }

  /** Compatibility accessor; new integrations should consume getSenderHistory coverage. */
  public async getSenderCounterparties(chainId: number, sender: string): Promise<KnownCounterparty[]> {
    return (await this.getSenderHistory(chainId, sender)).counterparties;
  }

  public async getSenderHistory(chainId: number, sender: string, options: Partial<HistoryLimits> = {},
    budget: ProviderBudget = createProviderBudget()): Promise<SenderHistory> {
    this.getChainConfig(chainId);
    if (!/^0x[0-9a-f]{40}$/i.test(sender)) throw new ProviderError('INVALID_SENDER');
    const limits: HistoryLimits = { maxPages: 3, maxRecords: 300, maxProviderCalls: 8, maxDurationMs: 10_000, ...options };
    for (const [key, max] of Object.entries({ maxPages: 20, maxRecords: 2000, maxProviderCalls: 40, maxDurationMs: 20_000 })) {
      const value = limits[key as keyof HistoryLimits];
      if (!Number.isSafeInteger(value) || value! < 1 || value! > max) throw new Error(`Invalid history limit: ${key}`);
    }
    if (limits.maxAgeDays !== undefined && (!Number.isFinite(limits.maxAgeDays) || limits.maxAgeDays <= 0)) {
      throw new Error('Invalid history age');
    }
    const cleanSender = sender.toLowerCase();
    const start = Date.now();
    const cutoff = limits.maxAgeDays === undefined ? 0 : start - limits.maxAgeDays * 86400000;
    budget.deadline = Math.min(budget.deadline, start + limits.maxDurationMs);
    const coverage: SenderHistory['coverage'] = {
      chainId, sender: cleanSender, pagesScanned: { transactions: 0, tokenTransfers: 0 }, recordsInspected: 0,
      uniqueCounterparties: 0, outgoingNativeTransfers: 0, outgoingTokenTransfers: 0,
      duplicatesSkipped: 0, incomingOnlyAddresses: 0, zeroValueInteractions: 0,
      paginationComplete: false, truncated: false, stopReasons: [], timeBudgetExhausted: false,
      requestBudgetExhausted: false, providerCalls: 0, providerErrors: [], fetchedAt: new Date(start).toISOString(), limits
    };
    const stop = (reason: string) => { if (!coverage.stopReasons.includes(reason)) coverage.stopReasons.push(reason); };
    const states = [
      { key: 'transactions' as const, route: `addresses/${cleanSender}/transactions`, cursor: {} as Record<string, string>, done: false, seen: new Set<string>() },
      { key: 'tokenTransfers' as const, route: `addresses/${cleanSender}/token-transfers?type=ERC-20`, cursor: {} as Record<string, string>, done: false, seen: new Set<string>() }
    ];
    const aggregate = new Map<string, KnownCounterparty>();
    const evidence: CounterpartyEvidence[] = [];
    const seenEvents = new Set<string>();
    const incoming = new Set<string>();
    const address = (v: any): string | undefined => {
      const hash = typeof v === 'string' ? v : v?.hash;
      return typeof hash === 'string' && /^0x[0-9a-f]{40}$/i.test(hash) ? hash.toLowerCase() : undefined;
    };
    // Round robin avoids spending the entire record/call budget on only one source.
    while (states.some(state => !state.done)) {
      for (const state of states) {
        if (state.done) continue;
        if (coverage.pagesScanned[state.key] >= limits.maxPages) { stop('PAGE_LIMIT'); state.done = true; continue; }
        if (coverage.recordsInspected >= limits.maxRecords) { stop('RECORD_LIMIT'); state.done = true; continue; }
        if (coverage.providerCalls >= limits.maxProviderCalls || budget.calls >= budget.maxCalls) {
          coverage.requestBudgetExhausted = true; stop('REQUEST_BUDGET'); state.done = true; continue;
        }
        if (Date.now() >= budget.deadline) { coverage.timeBudgetExhausted = true; stop('TIME_BUDGET'); state.done = true; continue; }
        const url = new URL(this.v2Url(chainId, state.route));
        for (const [key, value] of Object.entries(state.cursor)) url.searchParams.set(key, value);
        coverage.providerCalls++;
        try {
          const payload = await requestJson(url.toString(), budget, this.traceMetadata(chainId,
            state.key === 'transactions' ? 'SENDER_TRANSACTIONS' : 'SENDER_TOKEN_TRANSFERS', coverage.pagesScanned[state.key] + 1));
          if (!Array.isArray(payload.items)) throw new ProviderError('MALFORMED_HISTORY');
          coverage.pagesScanned[state.key]++;
          for (const item of payload.items) {
            if (coverage.recordsInspected >= limits.maxRecords) { stop('RECORD_LIMIT'); break; }
            coverage.recordsInspected++;
            if (!item || typeof item !== 'object') { stop('MALFORMED_RECORD'); continue; }
            const isToken = state.key === 'tokenTransfers';
            const from = address(item.from), to = address(item.to);
            const rawAmount = isToken ? item.total?.value : item.value;
            const hash = isToken ? item.transaction_hash : item.hash;
            const tokenAddress = isToken ? address(item.token?.address_hash) : undefined;
            if (!from || (!to && item.to !== null) || typeof rawAmount !== 'string' || !/^\d{1,78}$/.test(rawAmount)
              || typeof hash !== 'string' || !/^0x[0-9a-f]{64}$/i.test(hash)
              || (isToken && (!tokenAddress || item.token?.type !== 'ERC-20'))) {
              stop('MALFORMED_RECORD'); continue;
            }
            // Reverted logs cannot support a relationship if a provider supplies explicit failure status.
            if (isToken && item.status != null && item.status !== 'ok') {
              if (item.status !== 'error') stop('INCOMPLETE_STATUS');
              continue;
            }
            // Failed/pending native transactions are not observed payments.
            if (!isToken && item.status !== 'ok') {
              if (!['error', null].includes(item.status)) stop('INCOMPLETE_STATUS');
              continue;
            }
            if (!to) continue; // contract creation has no recipient relationship
            const timestamp = typeof item.timestamp === 'string' && Number.isFinite(Date.parse(item.timestamp)) ? item.timestamp : undefined;
            const blockNumber = Number.isSafeInteger(item.block_number) && item.block_number >= 0 ? item.block_number : undefined;
            const logIndex = Number.isSafeInteger(item.log_index) && item.log_index >= 0 ? item.log_index : undefined;
            if (!timestamp || blockNumber === undefined || (isToken && logIndex === undefined)) stop('INCOMPLETE_EVIDENCE');
            const eventKey = isToken
              ? `${chainId}:token:${hash.toLowerCase()}:${tokenAddress}:${logIndex ?? `${from}:${to}:${rawAmount}`}`
              : `${chainId}:native:${hash.toLowerCase()}`;
            if (seenEvents.has(eventKey)) { coverage.duplicatesSkipped++; continue; }
            seenEvents.add(eventKey);
            if (cutoff && (!timestamp || Date.parse(timestamp) < cutoff)) { stop('AGE_WINDOW'); continue; }
            if (from !== cleanSender && to !== cleanSender) { stop('UNRELATED_RECORD'); continue; }
            const direction = from === to ? 'SELF' : from === cleanSender ? 'OUTGOING' : 'INCOMING';
            const zero = BigInt(rawAmount) === 0n;
            const peer = direction === 'INCOMING' ? from : to;
            if (zero) coverage.zeroValueInteractions++;
            const relationship = zero ? 'ZERO_VALUE' : direction !== 'OUTGOING' ? 'INCOMING_ONLY'
              : (!timestamp || blockNumber === undefined || (isToken && logIndex === undefined)) ? 'INCOMPLETE'
              : isToken ? 'OUTBOUND_ERC20' : 'OUTBOUND_NATIVE';
            evidence.push({ chainId, address: peer, relationship, direction, transactionHash: hash.toLowerCase(),
              timestamp, blockNumber, rawAmount, tokenAddress, logIndex, initiatorVerified: !isToken });
            if (timestamp) {
              if (!coverage.oldestEvidenceAt || Date.parse(timestamp) < Date.parse(coverage.oldestEvidenceAt)) coverage.oldestEvidenceAt = timestamp;
              if (!coverage.newestEvidenceAt || Date.parse(timestamp) > Date.parse(coverage.newestEvidenceAt)) coverage.newestEvidenceAt = timestamp;
            }
            if (direction === 'INCOMING') incoming.add(peer);
            if (zero || direction !== 'OUTGOING') continue;
            if (isToken) coverage.outgoingTokenTransfers++; else coverage.outgoingNativeTransfers++;
            const existing = aggregate.get(to);
            if (existing) { existing.totalTransfers++; continue; }
            aggregate.set(to, { address: to, name: `Observed ${to.slice(0, 6)}…${to.slice(-4)}`,
              category: item.to?.is_contract ? 'CONTRACT' : 'VENDOR', verifiedSince: timestamp || 'Unknown observation date',
              totalTransfers: 1, source: 'BLOCKSCOUT_HISTORY', chainId,
              relationship: isToken ? 'OUTBOUND_ERC20' : 'OUTBOUND_NATIVE', evidenceTxHash: hash.toLowerCase() });
          }
          const next = payload.next_page_params;
          if (next === null) { state.done = true; continue; }
          if (!next || typeof next !== 'object' || Array.isArray(next) || !Object.keys(next).length || Object.keys(next).length > 20) {
            throw new ProviderError('MALFORMED_CURSOR');
          }
          const entries = Object.entries(next).sort(([a], [b]) => a.localeCompare(b));
          // Only query parameters are accepted. Provider cursors cannot change host, route, key or token filter.
          if (entries.some(([key, value]) => !/^[a-z_]{1,64}$/.test(key) || ['apikey', 'filter'].includes(key) || (key === 'type' && value !== 'ERC-20')
            || !['string', 'number', 'boolean'].includes(typeof value) || String(value).length > 256)) throw new ProviderError('MALFORMED_CURSOR');
          const cursor = Object.fromEntries(entries.map(([key, value]) => [key, String(value)]));
          const signature = JSON.stringify(cursor);
          if (state.seen.has(signature)) throw new ProviderError('REPEATED_CURSOR');
          state.seen.add(signature); state.cursor = cursor;
        } catch (error) {
          const code = error instanceof ProviderError ? error.code : 'INVALID_OR_UNAVAILABLE_RESPONSE';
          if (['MALFORMED_HISTORY', 'MALFORMED_CURSOR', 'REPEATED_CURSOR'].includes(code)) this.markSchemaError(budget,
            state.key === 'transactions' ? 'SENDER_TRANSACTIONS' : 'SENDER_TOKEN_TRANSFERS', code);
          coverage.providerErrors.push({ endpoint: state.key, code }); stop(code); state.done = true;
          if (/TIME/.test(code)) coverage.timeBudgetExhausted = true;
          if (code === 'REQUEST_BUDGET') coverage.requestBudgetExhausted = true;
        }
      }
    }
    const criticalMissing = !coverage.pagesScanned.transactions || !coverage.pagesScanned.tokenTransfers;
    if (criticalMissing) stop('CRITICAL_HISTORY_UNAVAILABLE');
    coverage.uniqueCounterparties = aggregate.size;
    coverage.incomingOnlyAddresses = [...incoming].filter(peer => !aggregate.has(peer)).length;
    for (const event of evidence) if (event.relationship === 'INCOMING_ONLY' && aggregate.has(event.address)) event.relationship = 'INCOMING';
    coverage.paginationComplete = coverage.stopReasons.length === 0;
    coverage.truncated = !coverage.paginationComplete;
    const result = { counterparties: [...aggregate.values()].sort((a, b) => a.address.localeCompare(b.address)), evidence, coverage };
    // Retain machine-readable coverage even when the decision must fail closed.
    if (criticalMissing) throw new HistoryUnavailableError(result);
    return result;
  }

  public async getAddressCounters(chainId: number, address: string, budget = createProviderBudget()): Promise<AddressCounterData> {
    const data = await requestJson(this.v2Url(chainId, `addresses/${address}/counters`), budget,
      this.traceMetadata(chainId, 'ADDRESS_COUNTERS'));
    const count = (value: unknown) => {
      if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d+$/.test(String(value))
        || !Number.isSafeInteger(Number(value))) throw new ProviderError('MALFORMED_COUNTERS');
      return Number(value);
    };
    try {
      return { transactionsCount: count(data.transactions_count), tokenTransfersCount: count(data.token_transfers_count),
        gasUsageCount: count(data.gas_usage_count ?? '0'), isContract: false };
    } catch (error) {
      this.markSchemaError(budget, 'ADDRESS_COUNTERS', 'MALFORMED_COUNTERS'); throw error;
    }
  }

  public async getAddressDetails(chainId: number, address: string, budget = createProviderBudget()): Promise<{
    isContract: boolean; isScamOrPhishing: boolean; name?: string; tags: string[]; reputationScore: number;
  }> {
    const data = await requestJson(this.v2Url(chainId, `addresses/${address}`), budget,
      this.traceMetadata(chainId, 'ADDRESS_DETAILS'));
    if (typeof data.is_contract !== 'boolean' || (data.is_scam !== undefined && typeof data.is_scam !== 'boolean')
      || (data.public_tags != null && (!Array.isArray(data.public_tags) || data.public_tags.some((tag: any) =>
        !tag || (typeof tag.label !== 'string' && typeof tag.tag !== 'string'))))) {
      this.markSchemaError(budget, 'ADDRESS_DETAILS', 'MALFORMED_ADDRESS');
      throw new ProviderError('MALFORMED_ADDRESS');
    }
    const tags: string[] = (data.public_tags || []).map((tag: any) => tag.label || tag.tag);
    const isScam = data.is_scam === true || tags.some(tag => /scam|phishing|drainer|hack|exploit/i.test(tag));
    return { isContract: data.is_contract, isScamOrPhishing: isScam,
      name: typeof data.name === 'string' ? data.name : undefined, tags, reputationScore: isScam ? 0 : 60 };
  }

  public async getContractSecurity(chainId: number, address: string, budget = createProviderBudget()): Promise<ContractSecurityData> {
    try {
      const data = await requestJson(this.v2Url(chainId, `smart-contracts/${address}`), budget,
        this.traceMetadata(chainId, 'SMART_CONTRACT'));
      if ((data.is_verified !== undefined && typeof data.is_verified !== 'boolean')
        || (data.source_code !== undefined && data.source_code !== null && typeof data.source_code !== 'string')) {
        this.markSchemaError(budget, 'SMART_CONTRACT', 'MALFORMED_CONTRACT');
        throw new ProviderError('MALFORMED_CONTRACT');
      }
      // Source verification is not a code audit. Reject truthy strings or arbitrary objects.
      const isVerified = data.is_verified === true || (data.is_verified === undefined && typeof data.source_code === 'string' && data.source_code.trim().length > 0);
      return { isContract: true, isVerified, contractName: typeof data.name === 'string' ? data.name : undefined,
        hasProxyPattern: data.is_proxy === true || (Array.isArray(data.implementations) && data.implementations.length > 0), isScamOrPhishing: false };
    } catch (error) {
      if (error instanceof ProviderError && error.code === 'HTTP_404') return { isContract: true, isVerified: false };
      throw error;
    }
  }
}
