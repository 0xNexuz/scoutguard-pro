# ScoutGuard PRO

Pre-signing risk checks for EVM payment agents. The service evaluates an intended ETH or allowlisted USDC transfer against Blockscout address history, reputation metadata, contract source verification, and deterministic policy limits. It returns `PASS`, `FLAG`, or `BLOCK`; it never signs or broadcasts a transaction.

## What works

- `POST /api/evaluate` runs a protected live Blockscout-backed check on seven configured chains: Ethereum, Base, Arbitrum, Optimism, Celo, Polygon, and Sepolia. It accepts native transfers and direct `transfer(address,uint256)` calldata for exact allowlisted USDC contracts, and blocks when required upstream data is unavailable. The token contract is the transaction destination; ScoutGuard decodes and checks the effective recipient.
- `POST /api/evaluate/public` lets judges and users evaluate Ethereum ETH or canonical USDC without a ScoutGuard service key. It is limited to five requests per minute per client in a single process.
- Address-poisoning checks automatically build their comparison set from the sender's recent positive-value outbound native transaction and ERC-20 transfer history. Operators may still add configured trusted counterparties. Observed history is a comparison reference, not proof that a payee is trusted.
- `POST /api/simulate/:scenarioId` runs five explicitly simulated scenarios through the same decision engine using fixtures. These results are for demonstrations only.
- The web dashboard includes a public live evaluation form with the computed result, sender-history provenance, individual checks, a local SHA-256 receipt digest, and exact Blockscout Explorer links. The digest is neither a signature nor an on-chain attestation.
- The live form includes three proposed-payment presets based on public Ethereum addresses observed through Blockscout. These show normal ETH, canonical USDC, and a USDC policy cap block; they do not represent historical ScoutGuard payments or confirmed attacks.
- A separate recorded research replay applies the current similarity rule to a [published Poison-Hunter address-poisoning sample](docs/evidence/2026-10-23-recorded-poisoning-replay.md) with a Blockscout transaction link. The replay is conditional on a research reference address and is labeled separately from live detection.
- The server does not enforce signing or control a wallet. The caller must check `executionAllowed`, bind the result to the exact transaction being signed, and fail closed if the service is unavailable.

Source verification does not mean a contract is safe or audited. Similarity checks cover the first recent history page returned by each Blockscout endpoint, not an exhaustive lifetime graph. The hourly policy limit and a deployment-wide public quota are not implemented. No claim of broad threat-feed coverage or 120-chain support is made.

## Run locally

Requires Node.js 22+.

```bash
npm ci
npm run build
npm test
npm start
```

Open `http://localhost:3030`. The dashboard demo works without a Blockscout key. Live evaluations may return `BLOCK` if public Blockscout endpoints reject or time out. Set `BLOCKSCOUT_API_KEY` in the environment to use the authenticated PRO gateway. Keep keys on the server. A local authenticated Ethereum evaluation passed on 2026-10-20; Base returned HTTP 402 because chain 8453 requires a paid Blockscout plan for this key. Chain access depends on your plan.

For local setup, copy `.env.example` to `.env` and fill in `BLOCKSCOUT_API_KEY`. The server loads `.env` automatically. `.env` is Git-ignored. Generate your own long random `SCOUTGUARD_SERVICE_KEY` for a protected live endpoint; it is not issued by Blockscout. Never put either value in browser code, a Git commit, a screenshot, or a chat message.

On Windows hosts whose Node trust store does not recognize the system certificate authority, run with `NODE_OPTIONS=--use-system-ca`. Keep TLS verification enabled.

## Evaluate a live candidate

The public judge path needs no private ScoutGuard key and is intentionally constrained to Ethereum:

```bash
curl -X POST http://localhost:3030/api/evaluate/public \
  -H 'Content-Type: application/json' \
  -d '{"from":"0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be","to":"0x1111111111111111111111111111111111111111","value":"0.1","chainId":1,"agentId":"public-evaluator"}'
```

Use the protected endpoint for an agent integration:

```bash
curl -X POST http://localhost:3030/api/evaluate \
  -H 'Content-Type: application/json' \
  -H 'x-scoutguard-key: YOUR_SERVICE_KEY' \
  -d '{"from":"0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be","to":"0x1111111111111111111111111111111111111111","value":"0.1","chainId":1,"agentId":"procurement-bot-01"}'
```

For native transfers, `to` is the payment recipient, `value` is the native decimal amount, and `data` is absent. For USDC, `to` is the canonical token contract, `value` is `"0"`, and `data` is ABI-encoded `transfer(recipient, rawAmount)`. The response receipt distinguishes `transactionTo` from the decoded `to`, and records the exact `rawAmount`, `transactionValue`, and `data`. Only canonical USDC contracts configured in `src/core/blockscout-client.ts` are accepted. `transferFrom`, arbitrary tokens, and other contract calls fail closed. The service key header is required by the protected endpoint when `SCOUTGUARD_SERVICE_KEY` is set, and that variable is mandatory in production. All API requests are limited to 60 per minute per client IP in a single process, while the public live endpoint has an additional 5-per-minute limit. Put an authenticated reverse proxy and shared rate limiter in front of a scaled deployment.

## Deployment

The checked-in Dockerfile builds TypeScript and local Tailwind CSS, then runs the API and dashboard in one Node service. The Express entry point is also in `src/index.ts` for Vercel detection; Vercel serves `public/` from its CDN. Production startup requires both `SCOUTGUARD_SERVICE_KEY` and `BLOCKSCOUT_API_KEY`; supply them using the deployment platform's secret manager. Do not set `NODE_TLS_REJECT_UNAUTHORIZED=0`. The old static Vercel configuration was removed because it could not serve the API.

The authenticated Ethereum PRO evaluation and public Explorer API comparison were verified locally. The full stack is deployed at [scoutguard.vercel.app](https://scoutguard.vercel.app/), where health, simulation, service-key enforcement, and an authenticated Ethereum evaluation passed on 2026-10-21. The Sprint 2 public live check, sender-history derivation, USDC path, updated branding, and live candidate presets are verified locally and await deployment. The expanded [Craftora project page draft](docs/CRAFTORA_SPRINT2_PROJECT_PAGE.md) awaits the user's publication. Docker image execution and a signing-agent integration were not verified. See [submission status](docs/build-harness/12_submission-map.md), [local PRO evidence](docs/evidence/2026-10-20-pro-ethereum.md), [deployment evidence](docs/evidence/2026-10-21-vercel-production.md), and [Sprint 2 feedback evidence](docs/evidence/2026-10-23-sprint-2-feedback.md) before claiming broader production readiness.

## License

No license file is currently included. Confirm the intended license before public reuse.
