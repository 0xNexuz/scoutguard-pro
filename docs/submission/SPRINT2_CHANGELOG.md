# Sprint 2 changes and judge-feedback mapping

The five Sprint 1 requests are transcribed in [the feedback record](../evidence/2026-10-23-sprint-2-feedback.md). This release combines earlier Sprint 2 work already on `main` with the new judging upgrade on `feat/scoutguard-final-judging-upgrade`.

| Feedback | Implementation | Evidence and boundary |
| --- | --- | --- |
| Payments are commonly USDC | Exact direct `transfer(address,uint256)` decoding for canonical Ethereum/Base USDC; effective beneficiary and six-decimal amount feed the same guard. | Production Ethereum 250 and 3,000 USDC checks on 25 Oct; Base live PRO access was previously plan-gated. Other ERC-20s are rejected. |
| Build poisoning references from Blockscout history | Bounded transaction/ERC-20 pagination derives outgoing counterparties; incoming-only, zero-value, failed and incomplete activity is distinguished. | Local traced run fetched 300 actual indexed rows; current sample had two outbound peers. Older Poison-Hunter reference was not recovered automatically. |
| Public real-address evaluation | Rate-limited public Ethereum ETH/USDC form; private agent API retains its service key. | Three fresh production baseline evaluations and one successful upgraded local PRO trace. Public path can fail closed or flag when history is incomplete. |
| Replace unrelated evidence | Archived three recorded live cases, actual historical transfer link, separate conditional poisoning research, now endpoint trace, observations, live relationship drill-down and export. | Each mode is labeled. Existing archive is a partial transcription, not a complete original receipt. The new local trace is not yet a production-upgrade proof. |
| Explain the project on Craftora | Full and short copy, judge quickstart, evidence matrix and walkthrough package are prepared. | Published Craftora text remains the older one-paragraph/17-test description until the user updates it. |

## New judging-upgrade code

- Sanitized per-evaluation provider trace records endpoint, chain, source, actual HTTP status, duration, timestamp, row count, pagination and error category. It contains no URL, header or API key.
- Public source label is derived from successful traced responses. A stub or fully failed provider cannot claim successful PRO data.
- Parsed recipient observations and trace are bound to the existing unkeyed receipt consistency digest. The agent adapter checks their equality with the response envelope.
- Concurrent provider failure cancels and settles sibling requests before receipt hashing, preventing a trace from changing after the digest is computed.
- The homepage leads to a live check, then recorded replay, then simulations. The evidence inspector separates observations, intelligence and policy; the relationship browser prioritizes outbound peers and provides search for busy wallets.
- The public live flow can download a sanitized evidence receipt. No wallet signing, replay API request, new chain scan, shared store, or protected-route weakening was introduced.
