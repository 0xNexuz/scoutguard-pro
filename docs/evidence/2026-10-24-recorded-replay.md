# Recorded evaluation replay provenance — 2026-10-24

The three static cases in `public/replay/records.json` transcribe production browser observations made on 2026-10-23 against the deployed `aa490c5` revision. They are partial records, not the original JSON receipts. The public production check was also summarized in [`2026-10-23-sprint2-production.md`](2026-10-23-sprint2-production.md). Earlier local checks are documented in [`2026-10-23-sprint-2-feedback.md`](2026-10-23-sprint-2-feedback.md); local sender-history counts may differ from the later production observations as Blockscout history changes. The static replay uses the production observations: one comparison counterparty was reported for these cases.

| Candidate | Recorded verdict | Recorded check contribution | Observed local SHA-256 digest |
|---|---|---|---|
| 0.1 ETH to `0x3f87…aae3` | PASS, 0/100 | 0 + 0 + 0 | `0x662258df1ba857b83cbe307f9e451a9ce1ae9537a23c7f22c4636650af59dfb6` |
| 250 canonical Ethereum USDC to `0x3f87…aae3` | PASS, 0/100 | 0 + 0 + 0 + 0 | `0x32f8862c04b2012f42c5be950ffec15da81b975e59f43b0010706faf4f73849f` |
| 3,000 canonical Ethereum USDC to `0x3f87…aae3` | BLOCK, 75/100 | 0 + 0 + 0 + 75 for the 2,500 USDC cap | `0x38f10a4e8f1f0732005ed722640850415a2b8bc0b7608a871f1c25e8a56a5bdc` |

The retained [Blockscout transfer event](https://eth.blockscout.com/tx/0x72b14bf09379c0de3c621035fe341a5ae9726c0dd5732ea3e2096c8e232eee9f) links the sample sender `0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be` and recipient `0x3f8702cfb1662195fcc98593789682da91dfaae3`. The transaction's top-level initiator is a different address. The event establishes an observed historical token transfer relationship; it is not one of ScoutGuard's proposed payments. None of the three candidates was signed or broadcast by ScoutGuard.

The original receipt IDs, exact API timestamps, and full inbound/trust lists were not retained. Replay shows the date only and labels those fields unknown. The policy version is read from the deployed source at `aa490c5`, not inferred from the receipt excerpt. The digest is an unkeyed local SHA-256 integrity value, not a Blockscout signature or authenticated provider attestation. The historical Poison-Hunter research case is a distinct conditional replay and is not in this recorded-live archive.

The player only fetches `/replay/records.json`. It does not call Blockscout, the public live endpoint, or the protected agent endpoint. Its record validator refuses malformed or mislabeled records before showing a decision.
