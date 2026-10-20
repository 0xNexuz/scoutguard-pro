import { AddressCounterData, ContractSecurityData } from '../types/index.js';

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

export class BlockscoutClient {
  private apiKey: string;
  private proApiBase: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.BLOCKSCOUT_API_KEY || '';
    this.proApiBase = 'https://api.blockscout.com/v2/api';
  }

  public getChainConfig(chainId: number): ChainConfig {
    return SUPPORTED_CHAINS[chainId] || {
      chainId,
      name: `EVM Chain ${chainId}`,
      baseUrl: 'https://eth.blockscout.com',
      apiUrl: 'https://eth.blockscout.com/api',
      currency: 'ETH'
    };
  }

  public getExplorerAddressUrl(chainId: number, address: string): string {
    const chain = this.getChainConfig(chainId);
    return `${chain.baseUrl}/address/${address}`;
  }

  public getExplorerTxUrl(chainId: number, txHash: string): string {
    const chain = this.getChainConfig(chainId);
    return `${chain.baseUrl}/tx/${txHash}`;
  }

  /**
   * Fetches address transaction counters from Blockscout
   */
  public async getAddressCounters(chainId: number, address: string): Promise<AddressCounterData> {
    const chain = this.getChainConfig(chainId);
    const endpoint = `${chain.baseUrl}/api/v2/addresses/${address}/counters`;

    try {
      const response = await fetch(endpoint, {
        headers: this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {},
        signal: AbortSignal.timeout(4000)
      });

      if (response.ok) {
        const data = await response.json();
        return {
          transactionsCount: parseInt(data.transactions_count || '0', 10),
          tokenTransfersCount: parseInt(data.token_transfers_count || '0', 10),
          gasUsageCount: parseInt(data.gas_usage_count || '0', 10),
          isContract: false // Address details endpoint clarifies this
        };
      }
    } catch {
      // Fallback or network error
    }

    return {
      transactionsCount: 0,
      tokenTransfersCount: 0,
      gasUsageCount: 0,
      isContract: false
    };
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
    const chain = this.getChainConfig(chainId);
    const endpoint = `${chain.baseUrl}/api/v2/addresses/${address}`;

    try {
      const response = await fetch(endpoint, {
        headers: this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {},
        signal: AbortSignal.timeout(4000)
      });

      if (response.ok) {
        const data = await response.json();
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
    } catch {
      // Network fallback
    }

    return {
      isContract: false,
      isScamOrPhishing: false,
      tags: [],
      reputationScore: 50
    };
  }

  /**
   * Inspects smart contract verification and source code status
   */
  public async getContractSecurity(chainId: number, address: string): Promise<ContractSecurityData> {
    const chain = this.getChainConfig(chainId);
    const endpoint = `${chain.apiUrl}?module=contract&action=getsourcecode&address=${address}${this.apiKey ? `&apikey=${this.apiKey}` : ''}`;

    try {
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(4000)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === '1' && Array.isArray(data.result) && data.result.length > 0) {
          const item = data.result[0];
          const hasSource = Boolean(item.SourceCode && item.SourceCode !== '');
          const isProxy = Boolean(item.Proxy === '1' || item.Implementation);

          return {
            isContract: true,
            isVerified: hasSource,
            contractName: item.ContractName || undefined,
            hasProxyPattern: isProxy,
            isScamOrPhishing: false
          };
        }
      }
    } catch {
      // Network fallback
    }

    return {
      isContract: false,
      isVerified: false
    };
  }

  /**
   * Queries real-time gas tracker oracle
   */
  public async getGasOracle(chainId: number): Promise<{
    safeGasPrice: string;
    proposeGasPrice: string;
    fastGasPrice: string;
  }> {
    const chain = this.getChainConfig(chainId);
    const endpoint = `${chain.apiUrl}?module=gastracker&action=gasoracle${this.apiKey ? `&apikey=${this.apiKey}` : ''}`;

    try {
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(3000)
      });
      if (response.ok) {
        const data = await response.json();
        if (data.status === '1' && data.result) {
          return {
            safeGasPrice: data.result.SafeGasPrice || '15',
            proposeGasPrice: data.result.ProposeGasPrice || '20',
            fastGasPrice: data.result.FastGasPrice || '25'
          };
        }
      }
    } catch {
      // Fallback
    }

    return {
      safeGasPrice: '20',
      proposeGasPrice: '25',
      fastGasPrice: '30'
    };
  }
}
