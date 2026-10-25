# Craftora Sprint 2 project copy

**Release gate:** Paste the text below only after the upgrade is merged and the live dashboard shows “Blockscout Intelligence — Live Evidence.” The published [ScoutGuard page](https://www.craftora.tech/project/scoutguard/) still has the Sprint 1 description and 17-test claim. This file does not update Craftora.

---

# ScoutGuard PRO — check the chain before an AI agent pays

**A pre-signing security check for autonomous EVM payments, powered by Blockscout PRO.** ScoutGuard evaluates an unsigned ETH or canonical USDC transfer before a payment agent can act. It returns `PASS`, `FLAG`, or `BLOCK` with the evidence and policy reasons behind that decision.

## The problem

An agent can copy a look-alike address from a polluted transaction history, send to an unverified destination, or exceed its spending policy in seconds. The public chain contains useful clues, but a signer needs a decision *before* it signs. ScoutGuard gives the signer a conservative pre-flight verdict; it never takes custody of a wallet, signs, or broadcasts.

## How it works

The caller submits the exact proposed transaction. ScoutGuard decodes direct USDC `transfer(address,uint256)` calldata so the security checks inspect the effective beneficiary, not merely the token contract. It rejects unsupported calldata and token contracts before provider access.

Blockscout PRO supplies recipient address details and activity counters, bounded sender transaction and ERC-20 transfer history, and contract source-verification metadata when relevant. ScoutGuard distinguishes observed outgoing recipients from incoming-only dust, compares the proposed beneficiary with observed and operator-configured references, checks phishing/scam signals and source status, then applies asset-specific payment limits. Missing critical provider evidence blocks; a usable but incomplete history scan cannot automatically pass.

The live evidence inspector makes those dependencies visible as three separate layers: **Blockscout observations**, **ScoutGuard relationship analysis**, and **security policy**. It shows sanitized endpoint statuses, page and row counts, historical Explorer links, selectable address relationships, risk contributions, and a downloadable receipt. The receipt's unkeyed SHA-256 digest checks consistency; it is not a Blockscout signature.

## Try it in about a minute

1. Open [the live dashboard](https://scoutguard.vercel.app/) and choose **Run Live Blockscout Check**. No private service key is needed for the public form.
2. Try the **observed recipient · ETH** or **USDC · live check** preset, then press **Run live Blockscout check**. These are proposed unsigned payments, not transactions sent by ScoutGuard. Results can be `FLAG` if bounded history is incomplete.
3. Inspect the endpoint trace and a historical relationship. Follow its [Blockscout Explorer address](https://eth.blockscout.com/address/0x3f8702cfb1662195fcc98593789682da91dfaae3) and [actual historical token-transfer transaction](https://eth.blockscout.com/tx/0x72b14bf09379c0de3c621035fe341a5ae9726c0dd5732ea3e2096c8e232eee9f). The transaction's initiator may differ from the token event sender.
4. Select **USDC cap · block** to see a proposed 3,000 USDC payment blocked by the 2,500 USDC per-payment policy. Then watch the **recorded live investigation** without another provider request. Five separate attack demonstrations remain labeled **SIMULATED**.

## Real, bounded results

On 25 October 2026, three public checks against the then-deployed application returned: proposed 0.1 ETH → `FLAG` (`25/100`), proposed 250 USDC → `FLAG` (`25/100`), and proposed 3,000 USDC → `BLOCK` (`100/100`). Each inspected 300 sender-history rows; both indexed endpoints reached the three-page cap, so neither lower-value case received automatic approval. The USDC cases returned a passing canonical-token verification check. A separate upgraded local run recorded **eight actual Blockscout PRO HTTP 200 responses** for recipient and sender-history endpoints, with 300 rows inspected and the same conservative `FLAG`. See the [timestamped trace](https://github.com/0xNexuz/scoutguard-pro/blob/main/docs/evidence/2026-10-25-successful-local-smoke.md) after release. This local trace must not be described as proof that the upgrade is already deployed.

The historical [Poison-Hunter example](https://github.com/0xNexuz/scoutguard-pro/blob/main/docs/evidence/2026-10-23-recorded-poisoning-replay.md) documents a real poisoning transfer and a 4-prefix/4-suffix look-alike. ScoutGuard's rule blocks a hypothetical payment to that look-alike *when the historical reference is supplied*. The current bounded live scan has **not** been shown to recover that older reference automatically, and there is no claim that ScoutGuard prevented the historical event.

The final local verification passed **151 automated tests and 26 Chromium browser checks** at 320, 390, 768 and 1280 pixels, with a clean build, strict typecheck, mock-agent enforcement run, and zero findings from `npm audit --audit-level=high`. Browser provider responses are fixtures; the separate local PRO trace above is the fresh-provider proof.

## Sprint 1 feedback → Sprint 2 work

| Judge request | What changed |
| --- | --- |
| Support stablecoin payments | Direct transfer to canonical Ethereum USDC is decoded to the true beneficiary and checked against token source metadata and USDC-specific limits. |
| Discover counterparties from Blockscout | Bounded native and ERC-20 sender history derives observed outbound references; incoming-only activity does not establish a trusted recipient. |
| Let judges test real addresses | Public, rate-limited Ethereum live form with ETH and USDC presets; private agent API remains protected. |
| Replace unrelated example evidence | Recorded live cases, a genuine historical token event, fresh local PRO trace and direct Explorer links are separately labeled by provenance. |
| Expand the project page | This walkthrough explains the problem, audience, provider dependency, real outcomes, verification path and limits. |

## Why ScoutGuard is different

ScoutGuard turns Blockscout observations into a decision at the transaction-signing boundary. The mock agent adapter checks receipt consistency, exact transaction and agent binding, freshness, fail-closed outcomes, and separate downstream authorization before an isolated mock signer can run. It demonstrates enforcement logic without claiming wallet integration or a real signature.

**Current limits:** Ethereum is the public judge path; other configured chains are not all live verified under this provider plan. History is bounded, not lifetime complete. Look-alike matching is a heuristic without measured prevention rates. No real wallet, authenticated provider signature, deployment-wide quota, or authoritative executed-spend ledger is included. A `PASS` is not a safety guarantee.

**Links:** [Live dashboard](https://scoutguard.vercel.app/) · [GitHub source and tests](https://github.com/0xNexuz/scoutguard-pro) · [Blockscout Explorer relationship evidence](https://eth.blockscout.com/tx/0x72b14bf09379c0de3c621035fe341a5ae9726c0dd5732ea3e2096c8e232eee9f) · [existing Sprint 1 demo video](https://youtu.be/QspG7x0YEgI)
