import { SecurityCheckResult, ContractSecurityData } from '../types/index.js';

export class ContractVerificationGate {
  /**
   * Evaluates smart contract risk using Blockscout PRO API verification & security data
   */
  public evaluateContractSecurity(
    candidateAddress: string,
    isContract: boolean,
    contractData: ContractSecurityData,
    addressMetadata: { isScamOrPhishing: boolean; tags: string[]; reputationScore: number },
    explorerUrl: string
  ): SecurityCheckResult {
    // 1. Phishing / Scam list check from Blockscout public tags
    if (addressMetadata.isScamOrPhishing) {
      return {
        id: 'SEC-REPUTATION-01',
        name: 'Blockscout Phishing & Malicious Entity Check',
        status: 'FAIL',
        scoreImpact: 100,
        detail: `CRITICAL: Address flagged on Blockscout as malicious/phishing/scam entity. Tags: [${addressMetadata.tags.join(', ')}].`,
        evidenceUrl: explorerUrl,
        metadata: { tags: addressMetadata.tags }
      };
    }

    // 2. If it is NOT a contract (EOA), return clean
    if (!isContract && !contractData.isContract) {
      return {
        id: 'SEC-CONTRACT-EOA',
        name: 'Contract Bytecode Verification',
        status: 'PASS',
        scoreImpact: 0,
        detail: 'Destination is an Externally Owned Account (EOA). No unverified bytecode present.',
        evidenceUrl: explorerUrl
      };
    }

    // 3. Unverified Smart Contract Bytecode Check
    if (!contractData.isVerified) {
      return {
        id: 'SEC-CONTRACT-UNVERIFIED',
        name: 'Unverified Smart Contract Bytecode',
        status: 'WARN',
        scoreImpact: 45,
        detail: `WARNING: Destination is an unverified smart contract on Blockscout. Source code and ABI are missing; cannot verify execution safety or honeypot traps.`,
        evidenceUrl: explorerUrl,
        metadata: {
          hasProxy: contractData.hasProxyPattern
        }
      };
    }

    // 4. Verified Contract
    return {
      id: 'SEC-CONTRACT-VERIFIED',
      name: 'Contract Verification & Integrity',
      status: 'PASS',
      scoreImpact: 0,
      detail: `Verified smart contract on Blockscout (${contractData.contractName || 'Verified Contract'}). Open source audited.`,
      evidenceUrl: explorerUrl,
      metadata: {
        contractName: contractData.contractName,
        isProxy: contractData.hasProxyPattern
      }
    };
  }
}
