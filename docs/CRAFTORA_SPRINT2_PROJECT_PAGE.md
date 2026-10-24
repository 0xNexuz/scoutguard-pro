# ScoutGuard PRO — final Craftora project-page draft

**Review draft, not published to Craftora.** The consolidated application was approved, merged in PR #2 and deployed at application release `160fff4`. CI passed 139 tests and 25 browser groups; authenticated Vercel-assisted root/health/graph/archive GETs returned 200. Fresh provider evaluations and direct anonymous-browser checks remain unverified from this restricted cloud. No business adoption or measured prevention metric is claimed.

## Problem and users

An autonomous payment agent can confuse a look-alike address with a real counterparty, interact with unverified code, or exceed its spending policy. Block explorers contain useful history, but an agent needs evidence and a deterministic decision before signing. ScoutGuard is designed for payment-agent developers, treasury automation and on-chain procurement teams.

## Solution and workflow

The agent constructs an exact unsigned ETH or canonical direct-USDC transaction. ScoutGuard validates the chain, transaction destination, calldata recipient and integer amount, retrieves Blockscout evidence, checks recipient resemblance/contract metadata and asset-specific policy, then returns PASS, FLAG or BLOCK with reasons, individual checks and a versioned integrity receipt.

BLOCK means abort. FLAG requires review and a fresh evaluation; the example adapter cannot automatically approve it. PASS can proceed only after independent downstream authorization and verification that the response matches the exact intended payment and remains fresh. ScoutGuard itself never holds a private key, signs or broadcasts.

## Why Blockscout is necessary

Recipient counters and tags, source-verification metadata, sender transactions, ERC-20 events, cursor pagination and exact Explorer evidence determine the evaluation. Missing required responses block rather than becoming a clean history. The integration is load-bearing, not just a set of links attached after an invented outcome. Source verification means code was published, not audited safe.

## Genuine USDC support

The unsigned transaction targets canonical Ethereum USDC and uses ABI-encoded `transfer(address,uint256)`. The engine evaluates its effective beneficiary separately from the token contract and applies six-decimal USDC policy limits with bigint arithmetic. Native limits are separate. Arbitrary contracts, transferFrom/other selectors, malformed calldata, contradictory assertions and unexpected native value fail closed. Canonical Base USDC is configured/tested, but recorded PRO access to Base returned HTTP 402 and no additional plan was purchased.

## Automatic historical discovery

Bounded API v2 pagination scans successful positive native payments and outgoing ERC-20 events. References include transaction evidence and explicit scan coverage; duplicates do not inflate relationships. Incoming-only, zero and failed interactions cannot establish outbound references. A token event sender is not assumed to be the transaction initiator. Observed relationships do not establish trust.

The similarity detector evaluates every relevant reference before choosing the strongest resemblance. Missing critical history blocks; valid incomplete history cannot PASS. Neither completed pagination nor absence of resemblance is proof of address safety. Internal transfers, index completeness, other-chain activity and unlimited lifetime graph recovery are outside scope.

## Product and investigation replay

The anonymous Ethereum form accepts ETH or canonical USDC and shows effective beneficiary, amount, check contributions, risk, coverage, provenance, digest and influencing evidence links. The protected service-key endpoint supports agent integration. Rate/concurrency/time/call/response controls bound local costs; deployment-wide coordination remains open.

The five-stage recorded replay walks through candidate, Blockscout evidence, relationships, security/policy checks and verdict. Its responsive SVG graph draws only the two retained addresses and separates the historical event from the proposed unsigned payment. Node/edge selection, keyboard navigation, speed, progress, reduced motion and receipt-excerpt download make it inspectable on mobile and desktop. The original three recorded cases remain partial transcriptions, with missing original IDs/times explicitly disclosed.

LIVE evaluations, RECORDED live results, the separate RECORDED research replay and SIMULATED scenarios stay distinct. The Poison-Hunter example is conditional resemblance with a published reference; improved live recovery was not verified here and historical prevention is not claimed.

## Reproduce and review

Clone the repository, use Node 22+, and run `npm ci`, `npm run build`, `npm run typecheck`, `npm test` and `npm audit --audit-level=high`. Start the app with `npm start`; supply server-side credentials through `.env.example` for genuine provider checks. The archive and labeled simulations work offline. Run `npm run demo:agent` for the isolated mock-signer harness and `npm run test:browser` with an existing Chromium executable for reproducible UI checks. Fixtures are explicitly synthetic and not live API proof.

Repository: https://github.com/0xNexuz/scoutguard-pro

Public baseline: https://scoutguard.vercel.app/

The comprehensive completion report and judge matrix identify exact final counts, evidence and release gates. The 100-second local walkthrough records real archived-case playback and simulations with captions; it does not submit the live form or create a new on-chain event. Narration, storyboard and submission checklist are prepared locally.

## Technical architecture

TypeScript/Express validates the candidate; a payment normalizer decodes exact native/USDC intent; a bounded Blockscout client collects evidence; similarity, source-metadata and policy checks produce a tri-state result. A canonical unkeyed SHA-256 receipt binds transaction/agent/policy/check/coverage fields. The example agent adapter uses trusted transport, consistency/transaction/freshness checks and separate authorization before an isolated signer boundary. Its test harness produces no real EVM signature.

## Evidence, limitations and roadmap

The repository preserves genuine Ethereum observations, October 23 production verification, the October 24 replay release and published research source as distinct evidence. Fresh Blockscout and direct anonymous-browser verification of the released integration remain blocked by this cloud's egress policy and absent credentials. Mocked HTTP, passing tests, Docker success and READY metadata do not resolve that limitation.

The digest is not an authenticated digital signature. Similarity has no measured efficacy/false-positive calibration. There is no real-wallet enforcement, authoritative hourly-execution ledger, authenticated receipt service or distributed quota. Unsigned candidates are never counted as completed spending. No paid infrastructure or production secret was changed.

Next: budgeted genuine provider/Explorer/anonymous checks, free-budget shared quota before scaling, a real downstream wallet/freshness/idempotency integration, authenticated receipt design if needed, and evaluation on a labeled dataset. Publication and submission remain with the user.
