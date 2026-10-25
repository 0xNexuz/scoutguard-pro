# Genuine local Blockscout PRO smoke — 25 October 2026

An explicitly run, one-case smoke against the upgraded local server used the configured Blockscout PRO key. Node TLS verification stayed enabled with Windows system CA trust (`NODE_USE_SYSTEM_CA=1`). The browser called ScoutGuard on localhost; the browser did not receive the provider key. This is a **fresh local application run**, not a deployed-upgrade claim. The smoke printed this sanitized summary to the terminal; the complete response was not archived, so only the fields below are asserted.

- Evaluation ID: `31f99aff-8e1b-4527-98f8-6eef0827af38`
- Evaluated: `2026-10-25T07:05:27.660Z`; mode `LIVE`; source `BLOCKSCOUT_PRO`
- Candidate: proposed unsigned 0.1 ETH, sender `0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be`, recipient `0x3f8702cfb1662195fcc98593789682da91dfaae3`
- Outcome: `FLAG`, risk `25/100`, due to `SEC-HISTORY-INCOMPLETE` (`PAGE_LIMIT`). The recipient and policy checks passed, but automatic approval was withheld.
- History: three native transaction pages and three ERC-20 transfer pages, 300 rows inspected, two outbound counterparties, pagination incomplete, no provider error in this run.

| Sanitized endpoint ID | Page | HTTP | Rows | Started UTC |
| --- | ---: | ---: | ---: | --- |
| `ADDRESS_COUNTERS` | — | 200 | — | 07:05:20.592 |
| `ADDRESS_DETAILS` | — | 200 | — | 07:05:20.854 |
| `SENDER_TRANSACTIONS` | 1 | 200 | 50 | 07:05:21.104 |
| `SENDER_TOKEN_TRANSFERS` | 1 | 200 | 50 | 07:05:22.610 |
| `SENDER_TRANSACTIONS` | 2 | 200 | 50 | 07:05:24.190 |
| `SENDER_TOKEN_TRANSFERS` | 2 | 200 | 50 | 07:05:24.628 |
| `SENDER_TRANSACTIONS` | 3 | 200 | 50 | 07:05:25.877 |
| `SENDER_TOKEN_TRANSFERS` | 3 | 200 | 50 | 07:05:26.434 |

The historical relationship with the sample recipient is supported separately by [this Blockscout transaction](https://eth.blockscout.com/tx/0x72b14bf09379c0de3c621035fe341a5ae9726c0dd5732ea3e2096c8e232eee9f). It contains a token-transfer event; the transaction initiator differs from the transfer sender. It is **not** a transaction sent by ScoutGuard and **not** proof that the proposed 0.1 ETH payment happened.

Later local attempts encountered provider timeouts under the four-second per-request bound and correctly returned `BLOCK`. The [sanitized timeout trace](2026-10-25-local-provider-timeout.json) and [inspector screenshot](../images/live-provider-timeout-1280.png) show the failure path. Repeated attempts were stopped; no timeout was relabeled as a successful evaluation.
