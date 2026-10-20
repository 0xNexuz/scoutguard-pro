import { SecurityCheckResult, KnownCounterparty, AddressCounterData } from '../types/index.js';

export interface PoisoningCheckResult {
  isPoisoningCandidate: boolean;
  severity: 'CLEAN' | 'SUSPICIOUS' | 'CRITICAL';
  matchedVendor?: KnownCounterparty;
  prefixMatchLength: number;
  suffixMatchLength: number;
  explanation: string;
}

export class PoisoningDetector {
  /**
   * Compares a candidate recipient address against a list of known approved counterparties
   * to detect vanity look-alike address collisions (the core mechanism of address poisoning).
   */
  public detectVanityCollision(
    candidateAddress: string,
    knownCounterparties: KnownCounterparty[]
  ): PoisoningCheckResult {
    const cleanCandidate = candidateAddress.toLowerCase();

    for (const vendor of knownCounterparties) {
      const cleanVendor = vendor.address.toLowerCase();

      // If it's an exact match, it is the legitimate vendor!
      if (cleanCandidate === cleanVendor) {
        return {
          isPoisoningCandidate: false,
          severity: 'CLEAN',
          matchedVendor: vendor,
          prefixMatchLength: 40,
          suffixMatchLength: 40,
          explanation: `Exact match with known verified vendor: ${vendor.name}`
        };
      }

      // Strip '0x' for hex comparison
      const candHex = cleanCandidate.startsWith('0x') ? cleanCandidate.slice(2) : cleanCandidate;
      const vendHex = cleanVendor.startsWith('0x') ? cleanVendor.slice(2) : cleanVendor;

      // Calculate prefix match
      let prefixMatch = 0;
      for (let i = 0; i < candHex.length; i++) {
        if (candHex[i] === vendHex[i]) {
          prefixMatch++;
        } else {
          break;
        }
      }

      // Calculate suffix match
      let suffixMatch = 0;
      for (let i = 0; i < candHex.length; i++) {
        if (candHex[candHex.length - 1 - i] === vendHex[vendHex.length - 1 - i]) {
          suffixMatch++;
        } else {
          break;
        }
      }

      // High-confidence look-alike threshold:
      // Most wallets display 4 to 6 chars at start and 4 chars at end (e.g. 0x1234...abcd)
      if (prefixMatch >= 4 && suffixMatch >= 4) {
        return {
          isPoisoningCandidate: true,
          severity: 'CRITICAL',
          matchedVendor: vendor,
          prefixMatchLength: prefixMatch,
          suffixMatchLength: suffixMatch,
          explanation: `CRITICAL LOOK-ALIKE: Candidate matches ${prefixMatch} leading and ${suffixMatch} trailing hex chars of '${vendor.name}' (${vendor.address.slice(0, 6)}...${vendor.address.slice(-4)}) but is a DIFFERENT address!`
        };
      } else if (prefixMatch >= 4 || suffixMatch >= 5) {
        return {
          isPoisoningCandidate: true,
          severity: 'SUSPICIOUS',
          matchedVendor: vendor,
          prefixMatchLength: prefixMatch,
          suffixMatchLength: suffixMatch,
          explanation: `SUSPICIOUS SIMILARITY: Partial collision (${prefixMatch} prefix, ${suffixMatch} suffix) with '${vendor.name}'.`
        };
      }
    }

    return {
      isPoisoningCandidate: false,
      severity: 'CLEAN',
      prefixMatchLength: 0,
      suffixMatchLength: 0,
      explanation: 'No look-alike collisions detected against known counterparty registry.'
    };
  }

  /**
   * Correlates vanity collision findings with Blockscout PRO API address counter metrics.
   * If an address mimics a known vendor but has near-zero transactions on Blockscout,
   * confidence of malicious poisoning reaches 99.9%.
   */
  public evaluatePoisoningRisk(
    candidateAddress: string,
    counterData: AddressCounterData,
    knownCounterparties: KnownCounterparty[],
    explorerUrl: string
  ): SecurityCheckResult {
    const vanityResult = this.detectVanityCollision(candidateAddress, knownCounterparties);

    if (vanityResult.severity === 'CRITICAL') {
      const isDormantOrBrandNew = counterData.transactionsCount <= 3;
      const scoreImpact = isDormantOrBrandNew ? 85 : 65;

      return {
        id: 'SEC-POISON-01',
        name: 'Address Poisoning / Vanity Collision',
        status: 'FAIL',
        scoreImpact,
        detail: `${vanityResult.explanation} (Blockscout History: ${counterData.transactionsCount} txs, ${counterData.tokenTransfersCount} transfers). Address is an unverified spoof.`,
        evidenceUrl: explorerUrl,
        metadata: {
          matchedVendor: vanityResult.matchedVendor?.name,
          vendorAddress: vanityResult.matchedVendor?.address,
          candidateAddress,
          prefixMatch: vanityResult.prefixMatchLength,
          suffixMatch: vanityResult.suffixMatchLength,
          blockscoutTxCount: counterData.transactionsCount
        }
      };
    }

    if (vanityResult.severity === 'SUSPICIOUS') {
      return {
        id: 'SEC-POISON-02',
        name: 'Vanity Prefix/Suffix Anomaly',
        status: 'WARN',
        scoreImpact: 35,
        detail: `${vanityResult.explanation} Verify destination carefully.`,
        evidenceUrl: explorerUrl,
        metadata: {
          matchedVendor: vanityResult.matchedVendor?.name,
          prefixMatch: vanityResult.prefixMatchLength,
          suffixMatch: vanityResult.suffixMatchLength
        }
      };
    }

    // If it is an exact match for a known verified vendor, it passes cleanly!
    if (vanityResult.matchedVendor) {
      return {
        id: 'SEC-POISON-OK',
        name: 'Counterparty Authenticity',
        status: 'PASS',
        scoreImpact: 0,
        detail: `Verified authentic destination for ${vanityResult.matchedVendor.name}.`,
        evidenceUrl: explorerUrl,
        metadata: {
          matchedVendor: vanityResult.matchedVendor.name,
          category: vanityResult.matchedVendor.category
        }
      };
    }

    // New counterparty without collision
    if (counterData.transactionsCount === 0 && counterData.tokenTransfersCount === 0) {
      return {
        id: 'SEC-COUNTER-01',
        name: 'Zero-History Counterparty Check',
        status: 'WARN',
        scoreImpact: 20,
        detail: `Recipient has 0 on-chain transactions and 0 transfers recorded on Blockscout. Unfunded or brand-new recipient.`,
        evidenceUrl: explorerUrl
      };
    }

    return {
      id: 'SEC-POISON-OK',
      name: 'Counterparty Authenticity',
      status: 'PASS',
      scoreImpact: 0,
      detail: `Normal recipient with ${counterData.transactionsCount} recorded transactions on Blockscout.`,
      evidenceUrl: explorerUrl
    };
  }
}
