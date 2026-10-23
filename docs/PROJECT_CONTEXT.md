# Project Context

Keep this file concise and evidence-based. Update current state in place, append decision-log entries, and never store secrets.

## Project Identity

- **Project name:** ScoutGuard PRO (AgentFinOps Security Layer)
- **Repository:** `https://github.com/0xNexuz/scoutguard-pro` (current checkout under this task's `work/scoutguard-pro`)
- **Project description:** Real-time pre-execution security oracle and policy firewall for autonomous AI payment agents and Web3 treasuries using Blockscout PRO API.
- **Current workflow stage:** DEVELOPMENT (Sprint 2 improvements)
- **Overall status:** SPRINT 2 FIXES VERIFIED LOCALLY — all five judge requests addressed in local code or submission draft; push, deployment, and Craftora editing pending authorization
- **Last updated date:** 2026-10-23

## Git State

- **Branch:** main
- **Last verified application commit:** `d02856d` on `main`
- **Working tree:** uncommitted Sprint 2 implementation and evidence updates
- **Relevant remote or PR:** `origin/main` → `https://github.com/0xNexuz/scoutguard-pro.git`; no PR
- **Last verified milestone:** Local public ETH and USDC evaluations with automatic Blockscout sender-history comparison and live dashboard evidence (2026-10-23)

## Hackathon Context

- **Competition:** Blockscout PRO API Buildathon (Sprint 2 improvement round)
- **Organizer:** Blockscout Core Team
- **Platform:** Craftora (`craftora.tech`)
- **Prizes:** Up to $1,200 equivalent in PRO API credits per official brief (page badge is inconsistent)
- **Eligibility:** 1 to 4 Devs, EVM builders
- **Official source links:** https://www.craftora.tech/sprints/blockscout-pro-api-buildathon/ and https://docs.blockscout.com/

## Strategic Decisions

- **Selected idea:** ScoutGuard PRO
- **Why it was selected:** Directly addresses the urgent risk of autonomous agent payments (address poisoning, vanity spoofing, unverified bytecode, honeypots) across 120+ EVM chains. Maximizes user leverage from KudiFlow/AgentFinOps assets. Makes Blockscout PRO API 100% load-bearing.
- **Rejected alternatives:** CleanProof (excessive ZK proof friction for sprint demo), ByteRadar (narrower judge appeal), RelayScout (lower differentiation).
- **Competitive advantages:** Intercepts attacks before signing; tri-state decision matrix (`PASS`, `FLAG`, `BLOCK`); cryptographic audit receipts with direct Blockscout Explorer links.
- **Intended target users:** AI agent developers, DAO treasuries, DeFi automation bots.

## Architecture Decisions

- **Technology stack:** Node.js / TypeScript + Express API + Tailwind CSS dark-mode dashboard.
- **Core architecture:**
  - `ScoutGuard Engine`: Core security oracle evaluating pre-flight transactions against Blockscout PRO API.
  - `PoisoningDetector`: Hex prefix/suffix similarity matching against historical address graphs.
  - `ContractVerificationGate`: Checks bytecode verification status and compiler metadata.
  - `PolicyFirewall`: Deterministic spending limits and rate limiter with human-in-the-loop quarantine.
  - `ReceiptSigner`: Generates immutable audit receipts with Blockscout explorer links.
  - `Interactive Dashboard`: High-conversion UI showing live simulations and real address audits.
- **Required integrations:** Blockscout PRO API (`/v2/api` and REST endpoints, multi-chain address counters, contract verification).
- **Security assumptions:** Blockscout failure returns `BLOCK`; caller must enforce the returned decision and bind it to the exact transaction. The server does not sign or broadcast.

## Development Progress

- **Approved implementation scope:**
  - M1: Core ScoutGuard Security Engine & Blockscout PRO API Client (with mock & live network modes)
  - M2: Address Poisoning & Vanity Collision Detector
  - M3: Smart Contract Verification & Bytecode Gate
  - M4: Deterministic Policy Firewall & Receipt Generator
  - M5: Interactive Verification & Attack Simulation Web Dashboard
  - M6: Automated Test Suite & Proof of Verification
- **Completed features:**
  - [x] M1: Blockscout API client for seven configured EVM chains; authenticated Ethereum PRO calls verified locally, Base gated by plan
  - [x] M2: Address Poisoning & Vanity Collision Detector (prefix & suffix collision algorithms)
  - [x] M3: Contract source verification and address tag checks; broad threat-feed coverage unverified
  - [x] M4: Per-transaction hard cap, `FLAG` decision, and local SHA-256 digest; no human approval workflow or signed receipt
  - [x] M5: Local full-stack fixture simulation dashboard; live Ethereum auditor verified through local HTTP
  - [x] M6: 17 passing local tests after hardening; no deployed end-to-end proof
- **Sprint 2 judge improvements:**
  - [x] Canonical USDC support with asset-specific policy limits and token contract verification
  - [x] Blockscout-derived recent sender history for poisoning detection
  - [x] Public Ethereum evaluation endpoint with a small rate limit
  - [x] Live dashboard evidence with exact Explorer links and explicit live/simulated provenance
  - [x] Expanded Craftora project page draft in `docs/CRAFTORA_SPRINT2_PROJECT_PAGE.md`; not published
- **Implemented but unverified:** Docker container execution and a real signing-agent integration.
- **Pending features:** Publish the expanded project page after user authorization; hourly volume enforcement and human approval workflow remain unimplemented.
- **P0 priorities:** Push and promote the verified Sprint 2 revision after user authorization, then update the Craftora project page with the prepared draft if authorized.
- **P1 priorities:** Production integration contract, transaction binding, and a shared rate limiter for horizontally scaled deployments.
- **P2 priorities:** Standalone SDK is not published.
- **P3 priorities:** Further visual polish after proof gates.
- **Current milestone:** Five judge requests addressed locally, including live candidate presets, logo/favicon, and Craftora copy; public production still serves the Sprint 1 revision.
- **Recorded research case:** Poison-Hunter sample dust transfer independently matched on Blockscout; the detector replay flags its look-alike at 4+4 hex characters. Live recent history did not recover the older research reference, so live poisoning prevention for this case is not claimed.
- **Known blockers:** Base PRO requests return HTTP 402 under this key's plan. Docker is unavailable here. User retained demo recording and Craftora submission.

## Verification

### Tests Actually Executed

| Date | Command or check | Environment | Result | Evidence or notes |
|---|---|---|---|---|
| 2026-10-20 | Toolchain Check (`node -v; npm -v`) | Local Windows PowerShell | VERIFIED | Node v24.12.0, npm 11.6.2, Python 3.13.7 |
| 2026-10-20 | Package Installation (`npm install`) | Local Windows PowerShell | VERIFIED | 112 packages added, 0 vulnerabilities |
| 2026-10-20 | TypeScript Compilation (`npm run build`) | Local Windows PowerShell | VERIFIED | `tsc` exited with code 0, 0 compiler errors |
| 2026-10-20 | Security Test Suite (`npx tsx --test test/scoutguard.test.ts`) | Local Windows PowerShell | VERIFIED | 13/13 unit and invariant tests passing (0 failures) |
| 2026-10-20 | Server Startup & Health Check (`/api/health`) | Local Windows PowerShell | VERIFIED | Server started on port 3030, status: ONLINE, blockscoutIntegration: ACTIVE |
| 2026-10-20 | `npm ci`, `npm run build`, `npm test` | Current local checkout | VERIFIED | 16 tests passed; Tailwind built locally |
| 2026-10-20 | Local HTTP smoke check on port 3038 | Current local checkout | VERIFIED | health ONLINE, simulated poisoning BLOCK, simulated vendor PASS, malformed evaluate 400 |
| 2026-10-20 | Live no-key Base evaluation | Current local checkout | BLOCKED | Blockscout counters returned HTTP 403; engine returned fail-closed BLOCK |
| 2026-10-20 | `npm audit fix`, audit | Current local checkout | VERIFIED | 0 vulnerabilities after lockfile update |
| 2026-10-20 | Browser inspection | Local in-app browser | VERIFIED | Mobile layout, demo jump link, scenario switching and simulated label |
| 2026-10-20 | Docker build | Current host | BLOCKED | Docker executable unavailable |
| 2026-10-20 | `npm run build`, `npm test` after PRO URL fix | Current local checkout | VERIFIED | 17 tests passed, including chain-scoped PRO URL regression |
| 2026-10-20 | Authenticated Blockscout PRO request | Ethereum chain 1, local | VERIFIED | Address details and counters returned HTTP 200; sanitized evidence in `docs/evidence/2026-10-20-pro-ethereum.md` |
| 2026-10-20 | Authenticated live evaluation | Ethereum chain 1, local | VERIFIED | `PASS`, `executionAllowed: true`, three check IDs; no transaction signed or broadcast |
| 2026-10-20 | Authenticated Base PRO request | Base chain 8453, local | BLOCKED BY PLAN | HTTP 402; Builder, Business, or Pro plan required |
| 2026-10-20 | Production-mode local HTTP smoke check | Port 3039, local | VERIFIED | 401 without service key; `PASS` with service key |
| 2026-10-20 | Public Explorer API versus authenticated PRO | Ethereum chain 1, local | VERIFIED | Both HTTP 200; same address, EOA status, transaction count 303 and token-transfer count 50173 |
| 2026-10-20 | Vercel entry point relocation | Current local checkout | VERIFIED locally | `npm run build`, 17 tests, and production-mode local root/health HTTP 200; public deployment pending account authentication |
| 2026-10-21 | Vercel production deployment | Public URL | VERIFIED | Health JSON 200, fixture simulation 200, unauthenticated evaluation 401, authenticated Ethereum evaluation 200 / `PASS` |
| 2026-10-21 | Public browser interaction | https://scoutguard.vercel.app/ | VERIFIED | Dashboard loaded; Vanity Poisoning selection changed computed labeled simulation to `BLOCK` |
| 2026-10-23 | `npm run build`, `npm test` | Current local checkout | VERIFIED | TypeScript build passed; 21/21 tests passed, including USDC, Blockscout history, and published-case replay invariants |
| 2026-10-23 | Production-mode public ETH and USDC HTTP checks | Port 3030, local | VERIFIED | Both returned HTTP 200 with `LIVE`, `BLOCKSCOUT_PRO`, and `PASS`; USDC included `SEC-TOKEN-USDC` |
| 2026-10-23 | Public dashboard live form | Local in-app browser | VERIFIED | Rendered live decision, three checks, two sender-history counterparties, receipt digest, and exact Explorer links |
| 2026-10-23 | USDC cap preset in dashboard | Local in-app browser | VERIFIED | 3,000 USDC rendered `LIVE · BLOCKSCOUT_PRO · BLOCK`, with `SEC-POLICY-CAP` and three Explorer links |
| 2026-10-23 | Historical token transfer evidence | Blockscout PRO and local engine | VERIFIED | Transaction endpoint returned HTTP 200/`ok` with a token transfer event from sample sender to recipient; live result includes the exact transaction URL |
| 2026-10-23 | Poison-Hunter recorded case | Published dataset, Blockscout PRO, local detector | VERIFIED as replay | Published attacker/victim/reference and tx matched an `ok` USDT dust transfer; detector found 4+4 match and `CRITICAL`. Live history missed the older reference; see `docs/evidence/2026-10-23-recorded-poisoning-replay.md`. |
| 2026-10-23 | Recorded case browser replay | Local production-mode server and in-app browser | VERIFIED | `/api/research-case/poisoning` returned `RECORDED_RESEARCH_REPLAY` / `BLOCK`; dashboard rendered addresses, 4+4 explanation, source links, and live-coverage limitation |

### Integration and Evidence Status

- **Real integrations:** Authenticated PRO gateway and deployed protected evaluation verified on Ethereum chain 1. The new public ETH/USDC evaluation and sender-history derivation are verified locally against live Blockscout data. Other configured chains are not fully verified; Base returned HTTP 402 under the supplied plan.
- **Simulated functionality:** Five fixture scenarios use the real local policy engine, explicitly labeled `SIMULATED`.
- **Verified evidence links:** Sanitized local evidence in `docs/evidence/2026-10-20-pro-ethereum.md`, deployment evidence in `docs/evidence/2026-10-21-vercel-production.md`, and Sprint 2 evidence in `docs/evidence/2026-10-23-sprint-2-feedback.md`. Explorer URLs identify the address and token pages used as supporting evidence; they are not transaction proofs.
- **Historical transaction proof:** Blockscout PRO returned an `ok` transaction with a token transfer event from the sample sender to recipient. The live result can link that transaction; it does not claim the proposed payment happened or that the sender initiated the top-level transaction.
- **Unverified claims:** Docker image, receipt authenticity beyond a local hash, previously claimed 120+ chains, SDK distribution, real signing-agent integration.

## Decision Log

### 2026-10-20 — ScoutGuard PRO Selected and Approved

- **Decision:** Build ScoutGuard PRO as the hackathon submission.
- **Reason:** Highest score (92/100), solves active address poisoning threat for autonomous agent payments, deeply integrates Blockscout PRO API across 120+ EVM chains.
- **Alternatives considered:** CleanProof, ByteRadar, RelayScout, ScoutMesh.
- **Evidence:** Craftora hackathon specifications, existing benchmarks (PreSend), Blockscout PRO docs.
- **Impact:** Focused 48-72h MVP scope with high demo impact.
- **Status:** APPROVED

### 2026-10-20 — Full MVP Built and Verified

- **Decision:** Complete M1 through M6 implementation and run automated tests.
- **Reason:** Satisfy core hackathon submission requirements with verified evidence.
- **Evidence:** 13/13 passing automated invariant tests, clean TypeScript build, active server and dashboard.
- **Impact:** Fully operational hackathon MVP ready for demonstration and video walkthrough.
- **Status:** VERIFIED

## Next Action

- **Next recommended action:** Verify the pushed Sprint 2 release on the public Vercel URL, then continue the documented open items.
- **Next authorized action:** User explicitly authorized GitHub push and Vercel deployment on 2026-10-23. Craftora submission and demo recording remain with the user.
- **Next approved milestone:** Ship and verify the judge-feedback release, recording actual deployment evidence.
- **Approval boundary:** Craftora publication and demo recording remain explicitly with the user.

### 2026-10-20 — Evidence correction and local hardening

- **Decision:** Treat the earlier “MVP verified / submission ready” narrative as historical and unsupported for live PRO and production use. Preserve its record above, but use the corrected current status and build-harness evidence.
- **Reason:** Repository inspection found silent upstream fallbacks, hardcoded UI outcomes, simulated phishing overrides, a static-only deployment config, and unsupported claims.
- **Evidence:** Current local build, 16 tests, HTTP smoke check; real no-key Blockscout request returned 403.
- **Status:** VERIFIED locally / BLOCKED for live PRO and submission.

### 2026-10-20 — Authenticated Ethereum PRO evaluation

- **Decision:** Use Ethereum chain 1 as the live evidence path for this key; keep Base marked plan-gated.
- **Reason:** The authenticated PRO gateway returned HTTP 200 for Ethereum address detail and counters, while Base returned HTTP 402 requiring a paid tier. A chain-scoped URL bug was fixed and protected by a regression test.
- **Evidence:** 17 passing tests, local authenticated `PASS` evaluation, and production-mode local HTTP check with 401 unauthenticated / `PASS` authenticated. Sanitized details are in `docs/evidence/2026-10-20-pro-ethereum.md`.
- **Status:** VERIFIED locally; public deployment, recording, push, and submission pending.

### 2026-10-20 — GitHub push and Explorer comparison

- **Decision:** Push the hardened MVP and prepare an Express entry point compatible with Vercel while preserving the Docker route.
- **Reason:** User authorized the push and deployment, then retained responsibility for the demo and Craftora submission.
- **Evidence:** Commit `4617a97` pushed to `origin/main`; public Explorer API and authenticated PRO gateway fields matched on Ethereum. Vercel entry point passed local build, tests, root, and health checks.
- **Status:** GitHub push VERIFIED; public deployment pending Vercel CLI login.

### 2026-10-21 — Production deployment and user handoff

- **Decision:** Promote the staged Express deployment to the existing ScoutGuard production URL after checking its protected health, root, and chain endpoints.
- **Reason:** The old Vercel project served static HTML for `/api/health`. The new deployment serves the API and dashboard together.
- **Evidence:** Public URL returned health JSON 200, simulation PASS 200, unauthorized evaluation 401, authenticated Ethereum PASS 200, and the dashboard responded to scenario switching. Details are in `docs/evidence/2026-10-21-vercel-production.md`.
- **Status:** PUBLIC MVP VERIFIED; user owns the demo video and Craftora submission.

### 2026-10-21 — Final public revision promoted

- **Decision:** Push the corrected public integration example and promote its Vercel build.
- **Evidence:** Commit `f033f3c` pushed to `origin/main`; deployment `dpl_CZc9ZnCLT1SF3aqYqs29m2TJqhny` promoted. Public root and health returned HTTP 200, the root contained the production evaluation URL and Ethereum chain 1, and evaluation without the service key returned HTTP 401.
- **Status:** VERIFIED on the public production URL; demo recording and Craftora submission remain with the user.

### 2026-10-23 — Sprint 2 judge requests implemented locally

- **Decision:** Add canonical USDC evaluation, derive look-alike counterparties from recent Blockscout sender history, expose a constrained public live evaluation route, and replace example evidence cards with a real live dashboard result.
- **Reason:** Judges scored Blockscout integration and demo quality at 2/5 and requested five concrete changes; the full screenshot adds the Craftora project-page expansion.
- **Evidence:** 20 passing tests; production-mode local ETH and USDC live requests; browser result `LIVE · BLOCKSCOUT_PRO · PASS` with two history counterparties and Explorer links; `docs/evidence/2026-10-23-sprint-2-feedback.md`.
- **Status:** VERIFIED locally for API and dashboard; Craftora text drafted, with external publication pending authorization.

### 2026-10-23 — Full feedback, branding, and traceable live cases

- **Decision:** Add a reusable ScoutGuard shield and route mark, browser favicon, three real-data candidate presets, and an expanded Craftora draft. Correct the integration sample to ethers and bind the returned transaction summary to its intended transfer.
- **Evidence:** Live Blockscout sender history returned two counterparties; the selected recipient was observed there. Local live checks returned `PASS` for 0.1 ETH and 250 USDC, and `BLOCK` for 3,000 USDC. The browser cap preset produced the same `BLOCK`. Build and 20 tests passed; `git diff --check` passed.
- **Status:** VERIFIED locally; no push, production promotion, Craftora edit, transaction signing, or broadcast performed.

### 2026-10-23 — Direct USDC transaction binding

- **Decision:** Normalize the unsigned direct ERC-20 transfer before security checks. Treat the token contract as the transaction destination and the calldata recipient as the payment destination. Use exact raw amounts for policy and bind the unsigned fields in the receipt digest.
- **Reason:** The earlier separate token/recipient/amount request could not prove that the evaluated payment matched the transaction an agent would sign.
- **Evidence:** `src/core/payment-normalizer.ts`, receipt and policy changes, updated browser and integration examples, and passing automated tests. The implementation checklist and open limits are in `docs/SPRINT2_IMPLEMENTATION_STATUS.md`.
- **Status:** VERIFIED locally; push and deployment authorized and in progress. Craftora publication and video remain with the user.
