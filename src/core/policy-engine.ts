import { GuardDecision, SecurityCheckResult, TokenConfig, TransactionCandidate } from '../types/index.js';
import { parseUnits } from 'ethers';

export interface AgentPolicyConfig {
  agentId: string;
  name: string;
  maxSingleTxValueEth: number;
  /** Legacy configuration only: NOT ENFORCED. No authoritative execution ledger is available. */
  maxHourlyVolumeEth: number;
  allowedChains: number[];
  requireHumanApprovalAboveEth: number;
  maxSingleTxValueUsdc: number;
  requireHumanApprovalAboveUsdc: number;
  enforceWhitelist: boolean;
  whitelistedAddresses: string[];
}

export const DEFAULT_AGENT_POLICIES: Record<string, AgentPolicyConfig> = {
  'procurement-bot-01': {
    agentId: 'procurement-bot-01',
    name: 'Autonomous Supplier Procurement Agent',
    maxSingleTxValueEth: 2.5,
    maxHourlyVolumeEth: 10.0,
    allowedChains: [1, 8453, 42161, 10, 42220, 137, 11155111],
    requireHumanApprovalAboveEth: 1.0,
    maxSingleTxValueUsdc: 2500,
    requireHumanApprovalAboveUsdc: 1000,
    enforceWhitelist: false,
    whitelistedAddresses: []
  },
  'treasury-sweeper-02': {
    agentId: 'treasury-sweeper-02',
    name: 'Multi-Chain Treasury Vault Sweeper',
    maxSingleTxValueEth: 5.0,
    maxHourlyVolumeEth: 25.0,
    allowedChains: [1, 8453, 42161, 42220],
    requireHumanApprovalAboveEth: 2.0,
    maxSingleTxValueUsdc: 10000,
    requireHumanApprovalAboveUsdc: 5000,
    enforceWhitelist: false,
    whitelistedAddresses: []
  }
};

export class PolicyEngine {
  private policies: Map<string, AgentPolicyConfig>;

  constructor(customPolicies?: AgentPolicyConfig[]) {
    this.policies = new Map();
    // Load defaults
    for (const [id, policy] of Object.entries(DEFAULT_AGENT_POLICIES)) {
      this.policies.set(id, policy);
    }
    if (customPolicies) {
      for (const p of customPolicies) {
        this.policies.set(p.agentId, p);
      }
    }
  }

  public getPolicy(agentId?: string): AgentPolicyConfig {
    const policy = this.policies.get(agentId ?? 'procurement-bot-01');
    if (!policy) throw new Error(`Unknown agent policy: ${agentId}`);
    return policy;
  }

  /**
   * Evaluates transaction value and limits against agent policy
   */
  public evaluatePolicy(
    tx: TransactionCandidate,
    explorerUrl: string,
    token?: TokenConfig
  ): SecurityCheckResult {
    const policy = this.getPolicy(tx.agentId);
    const decimals = token?.decimals ?? 18;
    const rawAmount = parseUnits(tx.value, decimals);
    if (rawAmount <= 0n || rawAmount >= 2n ** 256n) throw new Error('Invalid transaction amount');
    if (tx.rawAmount !== undefined && tx.rawAmount !== rawAmount.toString()) throw new Error('Raw amount mismatch');
    if (policy.enforceWhitelist && !policy.whitelistedAddresses.some(address => address.toLowerCase() === tx.to.toLowerCase())) {
      return { id: 'SEC-POLICY-WHITELIST', name: 'Recipient Allowlist', status: 'FAIL', scoreImpact: 100,
        detail: 'Effective payment recipient is not on the operator allowlist.' };
    }

    // 1. Allowed chain check
    if (!policy.allowedChains.includes(tx.chainId)) {
      return {
        id: 'SEC-POLICY-CHAIN',
        name: 'Agent Chain Authorization',
        status: 'FAIL',
        scoreImpact: 70,
        detail: `Agent '${policy.name}' is not authorized to transact on Chain ID ${tx.chainId}.`,
        evidenceUrl: explorerUrl
      };
    }

    const asset = token?.symbol || 'native units';
    const maxValue = token ? policy.maxSingleTxValueUsdc : policy.maxSingleTxValueEth;
    const approvalThreshold = token ? policy.requireHumanApprovalAboveUsdc : policy.requireHumanApprovalAboveEth;

    // 2. Max single transaction value hard cap
    if (rawAmount > parseUnits(String(maxValue), decimals)) {
      return {
        id: 'SEC-POLICY-CAP',
        name: 'Single Transaction Hard Limit',
        status: 'FAIL',
        scoreImpact: 75,
        detail: `Transaction value (${tx.value} ${asset}) exceeds agent hard limit (${maxValue} ${asset}).`,
        evidenceUrl: explorerUrl,
        metadata: {
          attemptedValue: tx.value,
          maxLimit: maxValue,
          asset
        }
      };
    }

    // 3. Human Approval Gate requirement
    if (rawAmount > parseUnits(String(approvalThreshold), decimals)) {
      return {
        id: 'SEC-POLICY-HUMAN-GATE',
        name: 'High-Value Human Approval Policy',
        status: 'WARN',
        scoreImpact: 30,
        detail: `Transaction value (${tx.value} ${asset}) exceeds autonomous limit (${approvalThreshold} ${asset}). Human signature required.`,
        evidenceUrl: explorerUrl,
        metadata: {
          attemptedValue: tx.value,
          threshold: approvalThreshold,
          asset
        }
      };
    }

    return {
      id: 'SEC-POLICY-OK',
      name: 'Agent Spending Limits & Policy',
      status: 'PASS',
      scoreImpact: 0,
      detail: `Value within autonomous limit (${tx.value} / ${maxValue} ${asset} cap).`,
      evidenceUrl: explorerUrl
    };
  }

  /**
   * Synthesizes all check results into a deterministic decision
   */
  public synthesizeDecision(checks: SecurityCheckResult[]): {
    decision: GuardDecision;
    riskScore: number;
    reasons: string[];
    suggestedAction: 'SIGN_AND_BROADCAST' | 'QUARANTINE_FOR_APPROVAL' | 'ABORT_TRANSACTION';
    executionAllowed: boolean;
  } {
    if (!Array.isArray(checks) || checks.length === 0 || checks.some(check => !check
      || !['PASS', 'WARN', 'FAIL'].includes(check.status) || !Number.isFinite(check.scoreImpact)
      || check.scoreImpact < 0 || check.scoreImpact > 100)) throw new Error('Missing or invalid security checks');
    let riskScore = 0;
    const reasons: string[] = [];
    let hasFail = false;
    let hasWarn = false;

    for (const check of checks) {
      riskScore += check.scoreImpact;
      if (check.status === 'FAIL') {
        hasFail = true;
        reasons.push(`[BLOCKED] ${check.name}: ${check.detail}`);
      } else if (check.status === 'WARN') {
        hasWarn = true;
        reasons.push(`[FLAGGED] ${check.name}: ${check.detail}`);
      }
    }

    // Cap risk score between 0 and 100
    riskScore = Math.min(100, Math.max(0, riskScore));

    // Decision logic
    if (hasFail || riskScore >= 60) {
      return {
        decision: 'BLOCK',
        riskScore,
        reasons,
        suggestedAction: 'ABORT_TRANSACTION',
        executionAllowed: false
      };
    }

    if (hasWarn || riskScore >= 25) {
      return {
        decision: 'FLAG',
        riskScore,
        reasons,
        suggestedAction: 'QUARANTINE_FOR_APPROVAL',
        executionAllowed: false
      };
    }

    return {
      decision: 'PASS',
      riskScore,
      reasons: ['All supplied address-data and policy checks passed. This is not a guarantee of transaction safety.'],
      suggestedAction: 'SIGN_AND_BROADCAST',
      executionAllowed: true
    };
  }
}
