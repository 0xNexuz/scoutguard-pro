# Evidence plan

| Claim | Required proof | Status |
|---|---|---|
| Local engine works | Build and test output | VERIFIED locally, 17 tests |
| Fail closed on outage | Outage invariant plus response | VERIFIED locally |
| PRO API is load-bearing | Authenticated request and actual response, redacted logs, Explorer comparison | VERIFIED locally on Ethereum; Explorer comparison pending |
| Public app works | Deployment URL with live API and browser capture | VERIFIED on 2026-10-21; see deployment evidence |
| Hackathon demo works | Recorded walkthrough showing simulation labels and real API proof | NOT PRODUCED |

Keep any captured evidence under `docs/evidence/` with date, command, sanitized output, and source URL. Do not commit API keys, invented hashes, or a demo verdict as public-chain proof.
