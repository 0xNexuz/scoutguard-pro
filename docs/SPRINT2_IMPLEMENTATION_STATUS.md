# Sprint 2 implementation status — 2026-10-23

The user-provided Sprint 2 implementation prompt is a target specification. This record separates implemented behavior from work still open. The judge's five feedback items are addressed in code or draft copy, but the prompt's 95% target has **not** been demonstrated.

| Area | Verified implementation | Limit |
|---|---|---|
| Direct USDC | Unsigned `transfer(address,uint256)` calldata is decoded; canonical Ethereum and Base USDC contracts are allowlisted; actual recipient and exact `bigint` amount are evaluated; unsupported selectors, `transferFrom`, mismatched contracts, and nonzero native value fail closed. | Base PRO requests may need a paid Blockscout plan. No general ERC-20 registry or allowance support. |
| Policy and receipt | Separate native and USDC limits compare exact units. Receipt digest includes chain, sender, transaction destination, effective recipient, raw amount, original value, and calldata. | Digest is unkeyed SHA-256, not an authenticated signature. Hourly limits are not implemented. A signing agent must compare the returned fields to the exact transaction before signing. |
| Poisoning detection | Recent outbound positive-value native and ERC-20 sender history builds comparison references. Incoming and zero-value events are excluded. Address similarity can block a look-alike; a published case is replayed separately with cited source and Explorer link. | Only the first page of each history endpoint is scanned. The historical reference for the published case was not recovered by that live scan. Observed history is not a trusted contact list. No claim of detecting that case live. |
| Public evaluation | Anonymous Ethereum ETH and USDC checks use the Blockscout-backed engine and show checks, receipt, provenance, and Explorer links. | The five-per-minute limiter is process-local. A shared deployment-wide quota and cost monitoring are open. |
| Evidence and submission | Local live ETH/USDC/cap checks and historical transfer event were recorded; expanded Craftora project-page copy is drafted; dashboard identifies live checks versus simulations and recorded replay. | No payment was sent by ScoutGuard. No video was recorded. Craftora page has not been published; user retained submission and video. |

## Reproduction

1. Run `npm ci`, `npm run build`, and `npm test`.
2. Set `BLOCKSCOUT_API_KEY` and `SCOUTGUARD_SERVICE_KEY` server-side; start with `npm start`.
3. Use the public dashboard's ETH, USDC, and cap presets. Inspect the `LIVE · BLOCKSCOUT_PRO` response and the sender, recipient, historical transfer, and USDC contract Explorer links.
4. Use the recorded poisoning replay separately. Its source and limitation are in [the case record](evidence/2026-10-23-recorded-poisoning-replay.md).

## Still open from the broader prompt

- Paginated, bounded sender history with explicit completeness metadata and older-reference recovery.
- A shared rate limiter, budget controls, and sustained load testing for public traffic.
- Authenticated receipts or verifier integration with a real signing agent.
- Hourly spending volume enforcement and broader adverse-case evaluation on a labeled dataset.
- Craftora publication and demo video, both reserved for the user.
