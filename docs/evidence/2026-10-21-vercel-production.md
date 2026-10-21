# Public Vercel deployment check — 2026-10-21

- Project: `xreyys-projects/scoutguard`
- Production URL: https://scoutguard.vercel.app/
- Staged and promoted deployment: `dpl_BesrPiG8zRwnGhXca7wcSDcci7ce`
- Source commit before the final documentation polish: `2d1f0f6`
- Final public revision: `f033f3c`, deployment `dpl_CZc9ZnCLT1SF3aqYqs29m2TJqhny`, promoted to production. The public root returned HTTP 200 and included the production `/api/evaluate` example and Ethereum `chainId: 1`; `/api/health` returned HTTP 200 `ONLINE`, while unauthenticated `/api/evaluate` returned HTTP 401.
- Secrets: `BLOCKSCOUT_API_KEY` and `SCOUTGUARD_SERVICE_KEY` are Vercel sensitive production variables. Their values are omitted here and from Git.

## Observed public behavior

| Request | Result |
|---|---|
| `GET /` | HTTP 200, ScoutGuard dashboard HTML |
| `GET /api/health` | HTTP 200, JSON `status: ONLINE` |
| `POST /api/simulate/legitimate-vendor` | HTTP 200, fixture-backed `PASS` |
| `POST /api/evaluate` without service key | HTTP 401, `Unauthorized` |
| `POST /api/evaluate` with service key, Ethereum chain 1, EOA candidate | HTTP 200, `PASS`, `executionAllowed: true`; checks `SEC-POISON-OK`, `SEC-CONTRACT-EOA`, `SEC-POLICY-OK` |
| Browser at public URL | Dashboard loaded; selecting Vanity Poisoning changed the labeled simulation from `PASS` to `BLOCK` and showed the computed collision checks |

The first authenticated request used a mixed-case source address that failed EIP-55 checksum validation and correctly returned HTTP 400. The valid all-lowercase source address passed. No transaction was signed or broadcast. The public demo scenarios are labeled `SIMULATED`; the protected evaluation endpoint queries live Blockscout data. Base chain 8453 remains unavailable under this Blockscout key's plan (HTTP 402 observed locally). Docker image execution and a real signing-agent integration were not tested.
