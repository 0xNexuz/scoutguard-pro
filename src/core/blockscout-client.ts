import { AddressCounterData, ContractSecurityData, KnownCounterparty, TokenConfig } from '../types/index.js';

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

type BlockscoutAddress = {
  hash?: string;
  name?: string;
  ens_domain_name?: string;
  is_contract?: boolean;
};

type BlockscoutHistoryItem = {
  from?: BlockscoutAddress | string;
  to?: BlockscoutAddress | string;
  timestamp?: string;
  hash?: string;
  transaction_hash?: string;
  value?: string;
  total?: { value?: string };
  status?: string;
};

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

  private addressHash(value?: BlockscoutAddress | string): string | undefined {
    if (typeof value === 'string') return value;
    return value?.hash;
  }

  /**
   * Builds a counterparty registry from the sender's recent outbound Blockscout history.
   * Incoming transfers are deliberately excluded so an attacker cannot seed trust by
   * sending a dust transfer to the sender.
   */
  public async getSenderCounterparties(chainId: number, sender: string): Promise<KnownCounterparty[]> {
    const cleanSender = sender.toLowerCase();
    const endpoints = [
      this.v2Url(chainId, `addresses/${sender}/transactions`),
      this.v2Url(chainId, `addresses/${sender}/token-transfers?type=ERC-20`)
    ];

    try {
      const responses = await Promise.all(endpoints.map(endpoint => fetch(endpoint, {
        signal: AbortSignal.timeout(12000)
      })));
      for (const response of responses) {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      }
      const payloads = await Promise.all(responses.map(response => response.json())) as Array<{ items?: BlockscoutHistoryItem[] }>;
      const aggregate = new Map<string, KnownCounterparty>();

      for (const [sourceIndex, payload] of payloads.entries()) {
        if (!Array.isArray(payload.items)) throw new Error('Malformed sender history response');
        for (const item of payload.items) {
          // A zero-value call or dust-sized ERC-20 event must not become a trusted payee.
          // Only actual outbound value is eligible as a comparison reference.
          const value = sourceIndex === 0 ? item.value : item.total?.value;
          if (!value || !/^\d+$/.test(value) || BigInt(value) === 0n || item.status === 'error') continue;
          const from = this.addressHash(item.from)?.toLowerCase();
          const to = this.addressHash(item.to)?.toLowerCase();
          if (!from || !to || from !== cleanSender || to === cleanSender) continue;
          const toDetails = typeof item.to === 'object' ? item.to : undefined;
          const possibleHash = item.transaction_hash || item.hash;
          const evidenceTxHash = possibleHash && /^0x[a-fA-F0-9]{64}$/.test(possibleHash) ? possibleHash : undefined;
          const existing = aggregate.get(to);
          if (existing) {
            existing.totalTransfers += 1;
            if (!existing.evidenceTxHash && evidenceTxHash) existing.evidenceTxHash = evidenceTxHash;
            continue;
          }
          aggregate.set(to, {
            address: to,
            name: toDetails?.name || toDetails?.ens_domain_name || `History ${to.slice(0, 6)}…${to.slice(-4)}`,
            category: toDetails?.is_contract ? 'CONTRACT' : 'VENDOR',
            verifiedSince: item.timestamp || 'Blockscout recent history',
            totalTransfers: 1,
            source: 'BLOCKSCOUT_HISTORY',
            evidenceTxHash
          });
        }
      }

      return [...aggregate.values()];
    } catch (error) {
      throw new Error(`Blockscout sender history unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Fetches address transaction counters from Blockscout
   */
  public async getAddressCounters(chainId: number, address: string): Promise<AddressCounterData> {
    const endpoint = this.v2Url(chainId, `addresses/${address}/counters`);

    try {
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(12000)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.transactions_count === undefined || data.token_transfers_count === undefined) {
          throw new Error('Malformed counters response');
        }
        const transactionsCount = Number(data.transactions_count);
        const tokenTransfersCount = Number(data.token_transfers_count);
        if (!Number.isSafeInteger(transactionsCount) || !Number.isSafeInteger(tokenTransfersCount)) {
          throw new Error('Invalid counters values');
        }
        return {
          transactionsCount,
          tokenTransfersCount,
          gasUsageCount: parseInt(data.gas_usage_count || '0', 10),
          isContract: false // Address details endpoint clarifies this
        };
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      throw new Error(`Blockscout counters unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Fetches address metadata, reputation tags, and contract status
   */
  public async getAddressDetails(chainId: number, address: string): Promise<{
    isContract: boolean;
    isScamOrPhishing: boolean;
    name?: string;
    tags: string[];
    reputationScore: number;
  }> {
    const endpoint = this.v2Url(chainId, `addresses/${address}`);

    try {
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(12000)
      });

      if (response.ok) {
        const data = await response.json();
        if (typeof data.is_contract !== 'boolean') throw new Error('Malformed address details response');
        const tags: string[] = [];
        if (data.public_tags) {
          tags.push(...data.public_tags.map((t: { label?: string; tag?: string }) => t.label || t.tag || ''));
        }

        const isScam = Boolean(
          data.is_scam || 
          tags.some(t => /scam|phishing|drainer|hack|exploit/i.test(t))
        );

        return {
          isContract: Boolean(data.is_contract),
          isScamOrPhishing: isScam,
          name: data.name || data.ens_domain_name || undefined,
          tags,
          reputationScore: isScam ? 0 : (data.is_verified ? 95 : 60)
        };
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      throw new Error(`Blockscout address details unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Inspects smart contract verification and source code status
   */
  public async getContractSecurity(chainId: number, address: string): Promise<ContractSecurityData> {
    const endpoint = this.v2Url(chainId, `smart-contracts/${address}`);

    try {
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(12000)
      });

      if (response.ok) {
        const data = await response.json();
        return {
          isContract: true,
          isVerified: Boolean(data.is_verified || data.source_code),
          contractName: data.name || undefined,
          hasProxyPattern: Boolean(data.is_proxy || data.implementations?.length),
          isScamOrPhishing: false
        };
      }
      if (response.status === 404) return { isContract: true, isVerified: false };
      throw new Error(`HTTP ${response.status} or invalid contract response`);
    } catch (error) {
      throw new Error(`Blockscout contract data unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

}
