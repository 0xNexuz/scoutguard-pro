# 🛡️ ScoutGuard PRO — AgentFinOps Security Firewall
> **The Missing Piece in Autonomous AI Agent Security**  
> *Pre-Execution Security Oracle & Policy Guardrails Powered by Blockscout PRO API across 120+ EVM Chains.*

[![Blockscout PRO API](https://img.shields.io/badge/Blockscout%20PRO%20API-120%2B%20EVM%20Chains-10B981)](https://docs.blockscout.com/)
[![Tests Passing](https://img.shields.io/badge/Tests-13%2F13%20Passing-blue)](test/scoutguard.test.ts)
[![Live App](https://img.shields.io/badge/Production-scoutguard.vercel.app-sky)](https://scoutguard.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

---

## 1. Visual Philosophy: "The Missing Piece"

> *"did you think they have forgotten, about your agents?"*  
> *"Water the Code, Guard the Treasury."*

Autonomous AI agents execute payments without human eyes. When transacting programmatically, they possess a critical cutout hole in their security perimeter: **address poisoning attacks** and **unverified smart contract traps**. 

ScoutGuard PRO acts as the missing puzzle piece that restores explorer-grade sight to automated agent treasuries.

---

## 2. The Core Problem

Autonomous AI payment agents (procurement bots, automated treasury sweepers, DeFi trading agents) are transacting billions across EVM ecosystems. However, programmatic execution exposes them to severe attack vectors:

1. **Address Poisoning Attacks:** Attackers generate vanity addresses sharing matching prefix and suffix characters with legitimate vendors (e.g. `0xd9A1...3a91`), dust the agent's recent history with zero-value transfers, and trick the agent or human signer into sending funds to the wrong address.
2. **Unverified Smart Contract / Trojan Traps:** Agents calling newly deployed, unverified bytecode with hidden honeypots or drainer logic.
3. **Phishing & Malicious Entities:** Transfers routed into wallets flagged across threat databases.
4. **Runaway Agent Spending:** Lack of deterministic hard limits and human-in-the-loop quarantine thresholds.

---

## 3. How Any AI Agent Integrates in 3 Lines of Code

ScoutGuard PRO drops directly into any AI agent framework (ElizaOS, LangChain, AutoGPT, Viem, Ethers):

```typescript
import { ScoutGuard } from '@scoutguard/sdk';

// 1. Pre-flight evaluation against Blockscout PRO API before signing
const inspection = await ScoutGuard.evaluateTransaction(txCandidate);

// 2. Enforce deterministic fail-closed safety gate
if (!inspection.executionAllowed) throw new Error(inspection.reasons[0]);

// 3. Safe to broadcast with cryptographic audit proof
await agentWallet.sendTransaction(txCandidate);
```

### ElizaOS Agent Action Plugin
```typescript
export const ScoutGuardAction: Action = {
  name: "VALIDATE_AND_EXECUTE_PAYMENT",
  handler: async (runtime, message, state) => {
    const inspection = await ScoutGuard.evaluateTransaction(message.tx);
    if (!inspection.executionAllowed) {
      return { success: false, reason: `BLOCKED: ${inspection.reasons[0]}` };
    }
    return await executeOnChainPayment(message.tx);
  }
};
```

---

## 4. Architecture & Blockscout PRO API Integration

```
[ Autonomous AI Agent / Bot ]
             │
             ▼ (Pre-Flight Tx Candidate)
┌────────────────────────────────────────────────────────┐
│                   SCOUTGUARD PRO                       │
│                                                        │
│  1. Poisoning Detector: Vanity Collision Algorithm     │
│  2. Contract Gate: Bytecode Verification & Threat Feed │
│  3. Policy Engine: Deterministic Spending Limits       │
│  4. Receipt Signer: Cryptographic SHA-256 Receipts     │
└────────────────────────────────────────────────────────┘
             │ (Load-Bearing Queries)
             ▼
┌────────────────────────────────────────────────────────┐
│               BLOCKSCOUT PRO API                       │
│  • /api/v2/addresses/{addr}/counters                   │
│  • /api/v2/addresses/{addr} (Reputation & Tags)        │
│  • module=contract&action=getsourcecode                │
│  • module=gastracker&action=gasoracle                  │
└────────────────────────────────────────────────────────┘
             │
             ▼ (Deterministic Decision)
  ┌──────────────────┬───────────────────┬──────────────────┐
  │   PASS (Green)   │   FLAG (Amber)    │   BLOCK (Red)    │
  │ Broadcast Signed │ Quarantine Gate   │ Fail-Closed Halt │
  └──────────────────┴───────────────────┴──────────────────┘
```

---

## 5. Live On-Chain Proofs & Blockscout Verifications

Every check in ScoutGuard is verifiable against real, live EVM explorer data:

| Network | Contract / Address / Tx Hash | Type | Blockscout Verification Link |
| :--- | :--- | :---: | :--- |
| **Base Mainnet (8453)** | `0x4e08c4e48b8b0e6dfb4c2780e0c90c749b5c36315802a8e807186101d279cf43` | Confirmed Tx | [View on Base Blockscout](https://base.blockscout.com/tx/0x4e08c4e48b8b0e6dfb4c2780e0c90c749b5c36315802a8e807186101d279cf43) |
| **Base Mainnet (8453)** | `0x2626664c2603336E57B271c5C0b26F421741e481` | Uniswap V3 Router | [Inspect Source Code](https://base.blockscout.com/address/0x2626664c2603336E57B271c5C0b26F421741e481) |
| **Ethereum (1)** | `0xd9A100913988f5CDbC328E07b8e5c14a60153a91` | Verified Vendor | [Inspect on Ethereum Blockscout](https://eth.blockscout.com/address/0xd9A100913988f5CDbC328E07b8e5c14a60153a91) |
| **Ethereum (1)** | Real-Time Gas Oracle Feed | Gas Tracker | [Open Blockscout Hub](https://eth.blockscout.com) |

---

## 6. Verification & Automated Tests

Run the test suite to verify all 13 security invariants:

```bash
npm install
npx tsx --test test/scoutguard.test.ts
```

All 13 unit, integration, and invariant tests pass cleanly:
- `PoisoningDetector`: Exact vendor match $\to$ `CLEAN`; Vanity collision spoof $\to$ `CRITICAL`.
- `ContractVerificationGate`: Scam feed tag $\to$ `FAIL`; EOA $\to$ `PASS`; Unverified contract $\to$ `WARN`.
- `PolicyEngine`: Within cap $\to$ `PASS`; Over hard limit $\to$ `FAIL`; Above human threshold $\to$ `WARN`.
- `ReceiptSigner`: Valid SHA-256 integrity hash and Blockscout URL.
- `ScoutGuard Orchestrator`: Invariant 1 (Address Poisoning Blocked) & Invariant 2 (Legitimate Vendor Passed).

---

## 7. Local Development

```bash
# Start local server & simulation studio:
npm run dev
# -> Opens http://localhost:3030
```
