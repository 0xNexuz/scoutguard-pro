# What judges can independently verify

## Provenance legend

| Label | Meaning |
| --- | --- |
| `LIVE` | A fresh public API evaluation. Only a successful per-request trace proves an upgraded Blockscout lookup. No payment is signed. |
| `RECORDED_LIVE_EVALUATION` | A saved, partial transcription of a prior production evaluation. Playback makes no new provider call; exact original receipt time and ID were not retained. |
| `RECORDED_RESEARCH_REPLAY` | A published poisoning case tested conditionally against ScoutGuard's rule with its research reference supplied. It was not an automatic historical catch. |
| `SIMULATED` | Synthetic provider fixtures run through the policy engine. Never evidence of a real attack or fresh provider response. |

## Fresh checks on 25 October 2026

| Location and time UTC | Candidate, unsigned | Result | Evidence | Limit |
| --- | --- | --- | --- | --- |
| Deployed baseline · 06:56:26 | 0.1 ETH | `FLAG` 25/100 | 300 sender rows, two outbound peers, history check WARN | Old response's PRO label came from env configuration; upstream HTTP statuses were not exposed there. |
| Deployed baseline · 06:56:31 | 250 canonical Ethereum USDC | `FLAG` 25/100 | Canonical token verification PASS; 300 history rows | Three-page cap on both indexed history routes; no automatic approval. |
| Deployed baseline · 06:56:35 | 3,000 canonical Ethereum USDC | `BLOCK` 100/100 | Canonical token verification PASS; `SEC-POLICY-CAP` FAIL | This is a **local payment policy block**, not evidence of a malicious address. |
| Upgraded local server · 07:05:27 | 0.1 ETH | `FLAG` 25/100 | [Eight genuine PRO HTTP 200 responses](../evidence/2026-10-25-successful-local-smoke.md), six history pages and 300 rows | This local trace predates PR #5 deployment and is not evidence of a successful production lookup after release. |
| Upgraded local server · 07:15:56 | 0.1 ETH | `BLOCK` 100/100 | [Sanitized timeout trace](../evidence/2026-10-25-local-provider-timeout.json), [inspector screenshot](../images/live-provider-timeout-1280.png) | Two required history requests timed out; ScoutGuard withheld approval. |

These evaluations cost provider requests; the archived replay and fixture browser suite do not. A browser/network request to ScoutGuard returning HTTP 200 means its application answered. It does **not**, by itself, establish every upstream Blockscout response succeeded. The local upgraded trace above records actual upstream statuses.

## Explorer proof and limits

- [Sample sender address](https://eth.blockscout.com/address/0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be) and [observed recipient address](https://eth.blockscout.com/address/0x3f8702cfb1662195fcc98593789682da91dfaae3).
- [Historical token-transfer transaction](https://eth.blockscout.com/tx/0x72b14bf09379c0de3c621035fe341a5ae9726c0dd5732ea3e2096c8e232eee9f): a past event relates those addresses. The transaction initiator is different from the token event sender; the event must not be described as a direct native ETH payment or a ScoutGuard transaction.
- [Canonical Ethereum USDC contract](https://eth.blockscout.com/address/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48). Source verification supports the contract metadata check; it is not an audit or guarantee.
- [Poison-Hunter poisoning transaction](https://eth.blockscout.com/tx/0xd599a08dc631fbae475bf9ba90f93d5ed075a896336a23027fc321f589d9de1b) and [original sample dataset](https://github.com/DS2L/Poison-Hunter/blob/main/phishing_transfers_sample.csv) support the separate research story. ScoutGuard's live bounded scan has not recovered the older comparison address; no prevented loss is asserted.

## Test and release boundary

The final local upgrade passed `npm run build`, `npm run typecheck`, **151/151 automated tests**, **26/26 Chromium browser checks**, `npm run demo:agent`, `npm audit --audit-level=high` (**zero vulnerabilities**) and `git diff --check`. The browser suite covers 320, 390, 768 and 1280 pixels, labels, inspector search/export, protected-route failures, replay and simulations. Browser tests use synthetic provider fixtures and record **zero actual Blockscout checks**. The manual smoke is intentionally separate from CI.

The [Craftora project page](https://www.craftora.tech/project/scoutguard/) advertised 17 tests and an older feature set when checked on 25 October. Updated project copy was supplied to the owner in chat. PR #5 deployed later that day; the upgraded homepage, live evidence script, health route and protected-route denial were verified on the live URL. A fresh successful production Blockscout trace after deployment has not been recorded here.
