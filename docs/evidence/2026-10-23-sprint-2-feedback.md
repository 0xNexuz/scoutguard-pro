# Sprint 2 Judge Feedback Evidence — 2026-10-23

The full judge message requests five changes. The fifth asks for an expanded Craftora project page. This record contains no credentials.

## Implemented

1. **USDC transfers:** The live engine accepts exact canonical USDC contracts on Ethereum and Base, applies USDC-specific limits, verifies the token contract through Blockscout, and binds the asset and token address into the receipt digest.
2. **Automatic poisoning comparison:** The engine derives counterparties from the sender's recent outbound native transactions and ERC-20 transfers returned by Blockscout. Inbound dust is excluded so an attacker cannot create trust by sending a token to the agent.
3. **Public live evaluation:** `POST /api/evaluate/public` permits Ethereum ETH and canonical USDC checks without the private ScoutGuard service key. The route is constrained to chain 1 and has an additional five-requests-per-minute, per-process limiter.
4. **Real dashboard evidence:** The static example cards were replaced by a live form. Results identify `LIVE` and `BLOCKSCOUT_PRO`, show each check, the sender-history comparison count, receipt digest, and the exact sender, recipient, and token Explorer links used for the evaluation.
5. **Project page:** An expanded problem, audience, Blockscout method, testing, and limitations draft is ready in `docs/CRAFTORA_SPRINT2_PROJECT_PAGE.md`. It has not been published to Craftora.

## Reproducible live candidate cases

The public sender address [0x3f5c…f0be](https://eth.blockscout.com/address/0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be) had two recent outbound counterparties in the Blockscout API response on 2026-10-23. One was [0x3f87…aae3](https://eth.blockscout.com/address/0x3f8702cfb1662195fcc98593789682da91dfaae3). These address links are evidence of the source and observed history; they do not prove that a ScoutGuard evaluation caused an on-chain payment.

| Proposed payment using those addresses | Local live decision | Checks |
|---|---|---|
| 0.1 ETH | `PASS` | `SEC-POISON-OK`, `SEC-CONTRACT-EOA`, `SEC-POLICY-OK` |
| 250 canonical Ethereum USDC | `PASS` | Same address and policy checks plus `SEC-TOKEN-USDC` |
| 3,000 canonical Ethereum USDC | `BLOCK` | `SEC-POLICY-CAP` failed against the procurement agent's 2,500 USDC hard limit |

The [canonical USDC contract](https://eth.blockscout.com/address/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48) was checked through Blockscout for verified source metadata. All three cases are proposed transactions evaluated against live address data and deterministic local policy. No actual attack or execution of these proposed payments is claimed.

### Historical transfer event proof

The Blockscout PRO transaction endpoint returned HTTP 200 and `status: ok` for [transaction `0x72b14b…eee9f`](https://eth.blockscout.com/tx/0x72b14bf09379c0de3c621035fe341a5ae9726c0dd5732ea3e2096c8e232eee9f). Its `token_transfers` array contains an event from the sample sender `0x3f5c…f0be` to recipient `0x3f87…aae3`. The top-level transaction initiator differs from that transfer sender, so this is proof of an observed historical token transfer event between those addresses, not proof that the sample sender initiated the transaction. It is unrelated to the proposed ScoutGuard payments above. The live result now links the observed event when Blockscout supplies a valid transaction hash.

## Verification

| Check | Result |
|---|---|
| `npm run build` | Passed with no TypeScript errors |
| `npm test` | 20/20 tests passed |
| Canonical Ethereum USDC invariant | `PASS`; included `SEC-TOKEN-USDC`; receipt asset was `USDC` |
| USDC precision invariant | Values beyond six decimal places fail closed |
| Blockscout-derived look-alike invariant | Detected the collision without configured counterparties |
| Production-mode local public ETH request | HTTP 200, `LIVE`, `BLOCKSCOUT_PRO`, `PASS` |
| Production-mode local public USDC request | HTTP 200, `LIVE`, `BLOCKSCOUT_PRO`, `PASS` |
| Browser live form | Rendered `LIVE · BLOCKSCOUT_PRO · PASS`, three checks, two history counterparties compared, receipt digest, and Explorer links |
| Browser USDC cap preset | Filled 3,000 USDC and rendered `LIVE · BLOCKSCOUT_PRO · BLOCK`, `SEC-POLICY-CAP`, two history counterparties, and three Explorer links |
| Branding | Header SVG logo and SVG favicon added to local dashboard |
| `git diff --check` | Passed; Git reported only local line-ending notices |

No transaction was signed or broadcast during these checks. The integration code is an example using ethers and environment-provided signer/destination; a real signer integration remains unverified. Deployment verification remains pending until this revision is pushed and promoted.

## Later security correction, same day

The earlier USDC cases in this record used separate `tokenAddress`, recipient, and human-readable amount fields. They verified live Blockscout address data and token-specific policy, but did not verify unsigned ERC-20 calldata. The release now requires an actual direct `transfer(address,uint256)` candidate, decodes its recipient and exact amount, and binds its original destination, value, and calldata into the receipt. Separate token assertions and unsupported selectors are rejected. The UI and agent example construct the direct call. The historical results above must not be represented as verification of the newer calldata path; deployment checks should rerun the USDC cases.
