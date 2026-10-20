import { GuardDecision, SecurityCheckResult, TransactionCandidate } from '../types/index.js';

export interface AgentPolicyConfig {
  agentId: string;
  name: string;
  maxSingleTxValueEth: number;
  maxHourlyVolumeEth: number;
  allowedChains: number[];
  requireHumanApprovalAboveEth: number;
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
    const policy = this.policies.get(agentId || 'procurement-bot-01');
    if (!policy) throw new Error(`Unknown agent policy: ${agentId}`);
    return policy;
  }

  /**
   * Evaluates transaction value and limits against agent policy
   */
  public evaluatePolicy(
    tx: TransactionCandidate,
    explorerUrl: string
  ): SecurityCheckResult {
    const policy = this.getPolicy(tx.agentId);
    const valueNum = Number(tx.value);
    if (!Number.isFinite(valueNum) || valueNum < 0 || !/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(tx.value)) {
      throw new Error('Invalid native transaction amount');
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

    // 2. Max single transaction value hard cap
    if (valueNum > policy.maxSingleTxValueEth) {
      return {
        id: 'SEC-POLICY-CAP',
        name: 'Single Transaction Hard Limit',
        status: 'FAIL',
        scoreImpact: 75,
        detail: `Transaction value (${valueNum} ETH) exceeds agent hard limit (${policy.maxSingleTxValueEth} ETH).`,
        evidenceUrl: explorerUrl,
        metadata: {
          attemptedValue: valueNum,
          maxLimit: policy.maxSingleTxValueEth
        }
      };
    }

    // 3. Human Approval Gate requirement
    if (valueNum > policy.requireHumanApprovalAboveEth) {
      return {
        id: 'SEC-POLICY-HUMAN-GATE',
        name: 'High-Value Human Approval Policy',
        status: 'WARN',
        scoreImpact: 30,
        detail: `Transaction value (${valueNum} ETH) exceeds autonomous limit (${policy.requireHumanApprovalAboveEth} ETH). Human signature required.`,
        evidenceUrl: explorerUrl,
        metadata: {
          attemptedValue: valueNum,
          threshold: policy.requireHumanApprovalAboveEth
        }
      };
    }

    return {
      id: 'SEC-POLICY-OK',
      name: 'Agent Spending Limits & Policy',
      status: 'PASS',
      scoreImpact: 0,
      detail: `Value within autonomous limit (${valueNum} / ${policy.maxSingleTxValueEth} ETH cap).`,
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
