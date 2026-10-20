# Threat model

Assets: payment funds, policy configuration, service key, Blockscout key, decision integrity. Actors: attacker supplying look-alike addresses, malicious API caller, failing or manipulated upstream data, and an agent that ignores a `FLAG` or `BLOCK`.

| Abuse case | Defense | Verification |
|---|---|---|
| Look-alike of registered counterparty | Collision check blocks | Unit test, fixture scenario |
| Blockscout outage | Required reads throw; engine blocks | Outage invariant test |
| Malformed amount or unsupported chain | Input rejection/fail closed | API validation smoke check |
| Unauthenticated production evaluation | Service key and rate limit | Code inspection; deployed check pending |
| Forged or stale decision | Caller must bind decision to exact tx | Not enforced end to end |

Limitations: no transaction simulation, calldata inspection, token amount accounting, persistent hourly volume tracking, human approval workflow, or signed/anchored receipts. Contract source verification does not prove safety. Production abuse and privacy tests are **UNVERIFIED**.
