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
   * Compares a candidate recipient address against a list of configured or observed counterparties
   * to detect vanity look-alike address collisions (the core mechanism of address poisoning).
   */
  public detectVanityCollision(
    candidateAddress: string,
    knownCounterparties: KnownCounterparty[]
  ): PoisoningCheckResult {
    const cleanCandidate = candidateAddress.toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(cleanCandidate)) throw new Error('Invalid candidate address');
    const unique = new Map<string, KnownCounterparty>();
    for (const peer of knownCounterparties) {
      const key = peer.address.toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(key)) throw new Error('Invalid comparison address');
      const previous = unique.get(key);
      // Prefer explicitly configured references when duplicate sources exist.
      if (!previous || (previous.source === 'BLOCKSCOUT_HISTORY' && peer.source !== 'BLOCKSCOUT_HISTORY')) unique.set(key, peer);
    }
    const findings: PoisoningCheckResult[] = [];
    for (const [address, peer] of unique) {
      const candidate = cleanCandidate.slice(2), reference = address.slice(2);
      let prefix = 0, suffix = 0;
      while (prefix < 40 && candidate[prefix] === reference[prefix]) prefix++;
      while (suffix < 40 && candidate[39 - suffix] === reference[39 - suffix]) suffix++;
      const exact = address === cleanCandidate;
      const severity = !exact && prefix >= 4 && suffix >= 4 ? 'CRITICAL'
        : !exact && (prefix >= 4 || suffix >= 5) ? 'SUSPICIOUS' : 'CLEAN';
      if (!exact && severity === 'CLEAN') continue;
      findings.push({ isPoisoningCandidate: !exact, severity, matchedVendor: peer,
        prefixMatchLength: prefix, suffixMatchLength: suffix,
        explanation: exact
          ? `Exact match with ${peer.source === 'BLOCKSCOUT_HISTORY' ? 'observed outbound' : 'operator-configured'} counterparty ${peer.address}; this does not prove safety.`
          : `${severity} LOOK-ALIKE: ${prefix} leading and ${suffix} trailing hex characters match ${peer.address}, but the candidate is a different address.` });
    }
    // Scan everything before selecting. An exact historical match cannot conceal a collision.
    const rank = { CRITICAL: 3, SUSPICIOUS: 2, CLEAN: 1 };
    findings.sort((a, b) => rank[b.severity] - rank[a.severity]
      || (b.prefixMatchLength + b.suffixMatchLength) - (a.prefixMatchLength + a.suffixMatchLength)
      || b.prefixMatchLength - a.prefixMatchLength
      || a.matchedVendor!.address.toLowerCase().localeCompare(b.matchedVendor!.address.toLowerCase()));
    return findings[0] || { isPoisoningCandidate: false, severity: 'CLEAN', prefixMatchLength: 0,
      suffixMatchLength: 0, explanation: `No resemblance detected in ${unique.size} inspected references; this is not proof of address safety.` };
  }

  /**
   * Correlates vanity collision findings with Blockscout PRO API address counter metrics.
   * Recent or absent history can increase concern but does not prove intent.
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
        detail: `${vanityResult.explanation} (Blockscout History: ${counterData.transactionsCount} txs, ${counterData.tokenTransfersCount} transfers). Treat as a potential look-alike until independently verified.`,
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
          vendorAddress: vanityResult.matchedVendor?.address,
          prefixMatch: vanityResult.prefixMatchLength,
          suffixMatch: vanityResult.suffixMatchLength
        }
      };
    }

    // Exact observations describe a relationship, not verified trust.
    if (vanityResult.matchedVendor) {
      return {
        id: 'SEC-POISON-OK',
        name: vanityResult.matchedVendor.source === 'BLOCKSCOUT_HISTORY' ? 'Observed Counterparty History' : 'Counterparty Authenticity',
        status: 'PASS',
        scoreImpact: 0,
        detail: `Exact match with ${vanityResult.matchedVendor.source === 'BLOCKSCOUT_HISTORY' ? 'an outbound counterparty derived from Blockscout sender history' : 'registered counterparty'} ${vanityResult.matchedVendor.name}.`,
        evidenceUrl: explorerUrl,
        metadata: {
          matchedVendor: vanityResult.matchedVendor.name,
          vendorAddress: vanityResult.matchedVendor.address,
          category: vanityResult.matchedVendor.category,
          source: vanityResult.matchedVendor.source || 'CONFIGURED'
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
      name: 'Inspected Counterparty Similarity',
      status: 'PASS',
      scoreImpact: 0,
      detail: `No resemblance detected among the inspected sender-history and configured references. Recipient has ${counterData.transactionsCount} recorded transactions; neither fact proves address safety.`,
      evidenceUrl: explorerUrl
    };
  }
}
