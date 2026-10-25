# Judge-minded review · 25 October 2026

This is an internal estimate against the [published Craftora rubric](https://www.craftora.tech/sprints/blockscout-pro-api-buildathon/), not a judge score or rank. It evaluates the branch's locally verified code and separately notes what a judge can see on the currently deployed baseline. Competing descriptions below come from their own Craftora pages, not independent audits.

| Criterion | Weight | Evidence-based estimate for this branch | Main remaining deduction |
| --- | ---: | ---: | --- |
| Blockscout API integration | 30 | 23–26 | Eight genuine local PRO successes prove the route, but the new trace is not deployed; the bounded scan cannot recover the older Poison-Hunter reference. |
| Real-world utility | 20 | 14–17 | ETH/USDC policy decisions work and fail closed; no actual agent wallet or deployed customer integration. |
| Technical execution | 20 | 15–17 | Strict payment normalization, capped pagination, provenance and receipt binding; no shared quota or authenticated receipt signature. |
| Creativity | 15 | 11–13 | Pre-signing Blockscout intelligence and mock enforcement are distinctive; measured attack-detection performance is absent. |
| UX and demo | 10 | 7–8 | Live-first interface and inspector verified locally; final released screenshots and 110-second video remain user work. |
| Blockscout showcase | 5 | 3–4 | Explorer links and endpoint trace are inspectable locally; updated Craftora page and deployed inspector are pending. |

These intervals total roughly **73–85/100 for the branch if released as verified**, before any unknown judge preferences. Current public presentation would score lower because the [published ScoutGuard page](https://www.craftora.tech/project/scoutguard/) still says 17 tests and the live site has the older UI. The interval is an editorial estimate, not a prediction of placement.

## Relevant comparisons

| Project's stated strength | ScoutGuard's credible distinction | Gap to acknowledge |
| --- | --- | --- |
| [PreSend](https://www.craftora.tech/project/presend/) describes as-of-block replay, spoofed-transfer checks and a documented WBTC poisoning investigation. | ScoutGuard enforces a decision before a mock agent signer can run and adds exact USDC policy control. | Its historical poisoning replay is conditional; the current bounded live scan has not reconstructed the older reference. Do not imply parity with PreSend's as-of-block proof. |
| [DiDo](https://craftora.tech/project/dido/) presents rich holder/funding graphs, source links and a credit ledger. | ScoutGuard keeps the narrower payment question actionable at signing time; its live graph now exposes actual outgoing/incoming-only relationships. | ScoutGuard's graph is bounded and its quotas are process-local. It does not offer DiDo's breadth or shared credit accounting. |
| [Carpan](https://craftora.tech/project/carpan/) emphasizes discovery provenance, RPC revalidation and immutable reviewed exports for payment research. | ScoutGuard evaluates a proposed unsigned payment before action, rather than reviewing a completed business movement. | ScoutGuard does not cross-check against RPC receipts, manage organization records or provide authenticated exports. |

## Highest-impact remaining gates

1. Release the branch and independently verify the new inspector on the production URL with one bounded successful PRO check. Preserve the timestamped result and screenshot. Do not call local-only proof production proof.
2. Replace the stale Craftora description with [the copy-ready project text](CRAFTORA_FINAL.md) and add a genuine product visual. The user owns submission and social posting.
3. Record the [110-second walkthrough](../demo/SPRINT2_RECORDING_PACKAGE.md) from the released product. Show an actual trace, its Explorer evidence and a distinct policy-cap block; use the recorded replay if live provider latency intervenes.
4. For a later security milestone, evaluate a reproducible as-of-block search against published poisoning cases and measure false positives. No such detection claim is made for this sprint.
