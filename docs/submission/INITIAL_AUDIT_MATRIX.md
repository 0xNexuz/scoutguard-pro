# Sprint 2 starting audit — 25 October 2026

This matrix describes remote `main` at `26dffe3` before the judging upgrade. The [published Craftora page](https://www.craftora.tech/project/scoutguard/) still described 17 tests and focused on five simulations. The [official rubric](https://www.craftora.tech/sprints/blockscout-pro-api-buildathon/) supplied the weights below.

| Judge requirement | Current code at baseline | Production proof at start | Presentation quality at start | Gap |
| --- | --- | --- | --- | --- |
| Blockscout API integration · 30% | Recipient details/counters, sender transactions/ERC-20 events, contract source, bounded cursors | Three fresh public checks on 25 Oct returned normalized history and decisions; response did not expose upstream statuses | Only address/transaction links and a coverage paragraph | Add sanitized per-request statuses, retrieved observations and accurate source labeling |
| Real-world utility · 20% | Unsigned ETH/USDC checks, 2,500 USDC cap, fail-closed adapter | ETH and 250 USDC returned `FLAG`; 3,000 USDC returned `BLOCK` | Live form sat behind simulations and SDK | Lead with actual use case and explain partial-history review |
| Technical execution · 20% | 142 automated tests, browser suite, auth, strict payment normalization, rate limits | Main CI and deployment checks passed; fresh provider requests not traced | Receipt digest and policy checks visible but scattered | Bind sanitized trace/observations into receipt; verify exported evidence and responsive UX |
| Creativity · 15% | Pre-signing look-alike comparison against observed outgoing peers | Historical Poison-Hunter replay conditional; no proof of automatic recovery from current bounded scan | Replay and graph separate from live check | Add real live relationship exploration; preserve the conditional research label |
| UX and demo · 10% | Editorial UI, five-stage recorded replay, five simulations | 25 browser checks previously passed | Hero led to simulations; no live request inspector | Live-first hierarchy, three provenance layers, concise judge path and demo package |
| Blockscout showcase · 5% | Explorer links in checks, saved replay evidence | Historical token event and provider-backed normalized output | Explorer evidence not connected to each live request | Endpoint trace, address/event drill-down and evidence receipt |

The 25 October production calls used the deployed baseline, before the new trace code. Their `source` field was based on configuration and **does not itself prove successful upstream HTTP statuses**. The later local traced evaluation supplies that separate proof. See [judging evidence](JUDGING_EVIDENCE.md).
