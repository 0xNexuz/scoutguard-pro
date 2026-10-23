# ScoutGuard PRO — Craftora project page draft

## The problem

Autonomous payment agents can send funds without a person checking the destination first. A look-alike address inserted into wallet history, an unverified recipient contract, or a payment above an agent's spending policy can turn a routine transfer into a costly mistake. A block explorer shows useful evidence, but the agent needs a decision before it signs.

## Who it is for

ScoutGuard PRO is for developers building AI payment agents, treasury automation, and on-chain procurement workflows. It is a pre-signing check that the caller can place between payment planning and wallet signing.

## How it works with Blockscout

The released flow supports a proposed ETH or allowlisted USDC payment; the hardening branch extends its historical scan. ScoutGuard queries Blockscout PRO for recipient counters, address metadata, contract source status, and the sender's bounded outbound transaction and ERC-20 transfer history. It compares the destination with counterparties derived from that history to flag look-alike addresses. It then applies agent and asset specific spending limits and returns `PASS`, `FLAG`, or `BLOCK` with individual check results, a local integrity digest, and Blockscout Explorer links. If required Blockscout data is unavailable, the decision is `BLOCK`. ScoutGuard never signs or broadcasts a transaction. A `PASS` is a policy result, not a guarantee of safety or proof that a historical payment occurred.

## Try the product

Open https://scoutguard.vercel.app/ and use **Live check**. Pick one of the proposed payment presets or enter Ethereum sender and recipient addresses, choose ETH or USDC, and select **Run live Blockscout check**. The public route needs no ScoutGuard service key and allows five checks per minute per client in one server process. The sample sender and recipient are public addresses whose recent outbound relationship was observed through Blockscout. Try 0.1 ETH for a normal policy result, 250 USDC for the supported token path, or 3,000 USDC to see the procurement agent's spending cap block. These are candidate evaluations against live data, not claims of real payments or attacks.

The **Demo** section contains five clearly labeled fixture simulations for reproducible attack and policy walkthroughs. The **Integration** section shows a server-side example that checks the protected API before invoking a USDC transfer. Production callers must enforce `executionAllowed` and bind approval to the exact transaction they sign.

Repository: https://github.com/0xNexuz/scoutguard-pro

## Evidence and limitations

The live result links the sender history, recipient, and USDC contract pages that informed the decision. For the sample recipient it also links a [past on-chain token transfer event](https://eth.blockscout.com/tx/0x72b14bf09379c0de3c621035fe341a5ae9726c0dd5732ea3e2096c8e232eee9f) observed between the sample addresses. That event is historical evidence of an address relationship; the proposed payment was not broadcast. The poisoning comparison currently covers bounded paginated Blockscout history with explicit completeness metadata in the hardening branch, not an exhaustive lifetime graph. Rate limiting is in process and needs a shared store for scaled production use. Base USDC is implemented but this Blockscout key's Base access returned HTTP 402, so the public judge path is Ethereum. Docker execution and a real wallet signer integration have not been verified.

**Publication note:** The original direct-USDC/public-evaluator revision was released and production-verified on October 23 at `aa490c5`; see the preserved production evidence. The bounded-history/security additions described here are verified locally on `feat/scoutguard-sprint2-hardening` and require review and approved deployment before being advertised as current production behavior. Craftora publication remains with the user. Preset PASS outcomes depend on current data and sufficient coverage; incomplete scans require review.

## Why Blockscout is necessary

Blockscout supplies the recipient counters and tags, source-verification metadata, sender history, cursor pagination and exact transaction evidence that determine these checks. Removing those responses makes the engine block rather than infer a clean destination. This is an API-backed pre-signing decision flow, not merely links added after a locally invented verdict. Source verification describes published code, not proof of an audit.

## Direct USDC support

The unsigned transaction targets the exact canonical Ethereum USDC contract and contains ABI-encoded `transfer(recipient, uint256)`. ScoutGuard decodes that recipient and raw amount, checks the beneficiary's data, verifies the token's canonical contract and source metadata, and applies six-decimal USDC policy limits. ETH limits are separate. Other selectors, transferFrom, arbitrary token contracts and nonzero native value fail closed. The service never spends or signs.

## Reproduce and inspect

Run `npm ci`, `npm run build`, `npm test`, then configure server-side credentials from `.env.example` and use `npm start`. The public form needs no private service key; the protected agent endpoint does. Automated tests use synthetic API v2 fixtures and ethers ABI encoding, cover pagination and older references, incoming/zero-value spam, strongest-match ordering, unavailable providers, raw-amount and chain mismatches, USDC thresholds, public abuse controls and receipt tampering. Tests are not live API proof. Review [the security notes](SPRINT2_HARDENING.md) for budgets and an opt-in six-call historical reconstruction command.

## Technical architecture and decisions

TypeScript/Express routes validate the unsigned candidate, a normalizer extracts the exact payment, the Blockscout client builds bounded evidence, the similarity and contract checks evaluate the effective recipient, and the policy engine returns PASS/FLAG/BLOCK. Full checks and transaction fields are recorded in a versioned SHA-256 integrity receipt. PASS means the inspected checks passed, FLAG requires human review, and BLOCK requires aborting. Required data loss blocks; incomplete valid history cannot PASS. The digest is not an authenticated signature.

## Evidence and roadmap

The repository preserves real Ethereum Blockscout observations, the October 23 production verification, a sourced Poison-Hunter research replay and labeled simulations as distinct categories. The improved historical scanner has not recovered the research reference in a fresh live check here: outbound network restrictions prevent the check. No historical loss prevention, business adoption or measured detection efficacy is claimed.

Next: approved deployment and anonymous verification, a free-budget shared quota before scaling, a real signing-agent verifier and freshness policy, hourly-volume accounting, evaluation on a labeled dataset, and the separate interactive investigation graph/replay. Shared infrastructure is a proposal, not an activated service. The expanded draft has not been published to Craftora.
