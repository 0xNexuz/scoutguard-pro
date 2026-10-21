# ScoutGuard PRO

Pre-signing risk checks for EVM payment agents. The service evaluates an intended native-asset transfer against Blockscout address history, reputation metadata, contract source verification, a local counterparty registry, and deterministic policy limits. It returns `PASS`, `FLAG`, or `BLOCK`; it never signs or broadcasts a transaction.

## What works

- `POST /api/evaluate` runs a live Blockscout-backed check on seven configured chains: Ethereum, Base, Arbitrum, Optimism, Celo, Polygon, and Sepolia. It blocks when required upstream data is unavailable.
- `POST /api/simulate/:scenarioId` runs five explicitly simulated scenarios through the same decision engine using fixtures. These results are for demonstrations only.
- The web dashboard shows the computed result, individual checks, and a local SHA-256 receipt digest. The digest is neither a signature nor an on-chain attestation.
- The server does not enforce signing or control a wallet. The caller must check `executionAllowed`, bind the result to the exact transaction being signed, and fail closed if the service is unavailable.

Source verification does not mean a contract is safe or audited. Similarity checks only compare against a configured registry; the production registry is empty until an operator supplies trusted counterparties in code. The hourly policy limit is not implemented. No claim of broad threat-feed coverage or 120-chain support is made.

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

```bash
curl -X POST http://localhost:3030/api/evaluate \
  -H 'Content-Type: application/json' \
  -H 'x-scoutguard-key: YOUR_SERVICE_KEY' \
  -d '{"from":"0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be","to":"0x1111111111111111111111111111111111111111","value":"0.1","chainId":1,"agentId":"procurement-bot-01"}'
```

`value` is a decimal amount in the chain's native unit, up to 18 decimal places. No ERC-20 amount conversion or calldata inspection is implemented. The service key header is required when `SCOUTGUARD_SERVICE_KEY` is set, and that variable is mandatory in production. Requests are limited to 60 per minute per client IP in a single process. Put an authenticated reverse proxy and shared rate limiter in front of a scaled deployment.

## Deployment

The checked-in Dockerfile builds TypeScript and local Tailwind CSS, then runs the API and dashboard in one Node service. The Express entry point is also in `src/index.ts` for Vercel detection; Vercel serves `public/` from its CDN. Production startup requires both `SCOUTGUARD_SERVICE_KEY` and `BLOCKSCOUT_API_KEY`; supply them using the deployment platform's secret manager. Do not set `NODE_TLS_REJECT_UNAUTHORIZED=0`. The old static Vercel configuration was removed because it could not serve the API.

The authenticated Ethereum PRO evaluation and public Explorer API comparison were verified locally. The full stack is deployed at [scoutguard.vercel.app](https://scoutguard.vercel.app/), where health, simulation, service-key enforcement, and an authenticated Ethereum evaluation passed on 2026-10-21. Docker image execution and a signing-agent integration were not verified. See [submission status](docs/build-harness/12_submission-map.md), [local PRO evidence](docs/evidence/2026-10-20-pro-ethereum.md), and [deployment evidence](docs/evidence/2026-10-21-vercel-production.md) before claiming broader production readiness.

## License

No license file is currently included. Confirm the intended license before public reuse.
