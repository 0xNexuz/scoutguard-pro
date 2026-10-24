# ScoutGuard PRO

Pre-signing risk checks for EVM payment agents. The service evaluates an intended ETH or allowlisted USDC transfer against Blockscout address history, reputation metadata, contract source verification, and deterministic policy limits. It returns `PASS`, `FLAG`, or `BLOCK`; it never signs or broadcasts a transaction.

## What works

- `POST /api/evaluate` runs a protected live Blockscout-backed check on seven configured chains: Ethereum, Base, Arbitrum, Optimism, Celo, Polygon, and Sepolia. It accepts native transfers and direct `transfer(address,uint256)` calldata for exact allowlisted USDC contracts, and blocks when required upstream data is unavailable. The token contract is the transaction destination; ScoutGuard decodes and checks the effective recipient.
- `POST /api/evaluate/public` lets judges and users evaluate Ethereum ETH or canonical USDC without a ScoutGuard service key. It is limited to five requests per minute per client, twenty per process, and two concurrent public evaluations in this hardening branch. Limits remain process-local.
- Address-poisoning checks automatically build their comparison set from the sender's bounded, paginated positive-value outbound native transaction and ERC-20 event history. Operators may still add configured trusted counterparties. Observed history is a comparison reference, not proof that a payee is trusted.
- `POST /api/simulate/:scenarioId` runs five explicitly simulated scenarios through the same decision engine using fixtures. These results are for demonstrations only.
- The web dashboard includes a public live evaluation form with the computed result, sender-history provenance, individual checks, a local SHA-256 receipt digest, and exact Blockscout Explorer links. The digest is neither a signature nor an on-chain attestation.
- The live form includes three proposed-payment presets based on public Ethereum addresses observed through Blockscout. These show normal ETH, canonical USDC, and a USDC policy cap block; they do not represent historical ScoutGuard payments or confirmed attacks.
- A separate recorded research replay applies the current similarity rule to a [published Poison-Hunter address-poisoning sample](docs/evidence/2026-10-23-recorded-poisoning-replay.md) with a Blockscout transaction link. The replay is conditional on a research reference address and is labeled separately from live detection.
- The server does not enforce signing or control a wallet. The caller must check `executionAllowed`, bind the result to the exact transaction being signed, and fail closed if the service is unavailable.

Source verification does not mean a contract is safe or audited. History scans disclose coverage, timestamps and truncation. Missing critical data blocks; valid incomplete history requires review and cannot PASS. No resemblance in inspected history is not proof of address safety. The hourly policy limit and a deployment-wide public quota are not implemented. No claim of broad threat-feed coverage or 120-chain support is made.

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

For native transfers, `to` is the payment recipient, `value` is the native decimal amount, and `data` is absent. For USDC, `to` is the canonical token contract, `value` is `"0"`, and `data` is ABI-encoded `transfer(recipient, rawAmount)`. The response receipt distinguishes `transactionTo` from the decoded `to`, and records the exact `rawAmount`, `transactionValue`, and `data`. Only canonical USDC contracts configured in `src/core/blockscout-client.ts` are accepted. `transferFrom`, arbitrary tokens, and other contract calls fail closed. The protected endpoint always requires the service key; absent configuration denies access. Production requires that variable. All API requests are limited to 60 per minute per client IP in a single process, while the public live endpoint has an additional 5-per-minute limit. This branch also bounds provider calls, response size, request duration and process-wide request spacing, rejects compressed JSON and cools down after provider failures. Use shared quotas before scaling; none were provisioned.

## Deployment

The checked-in Dockerfile builds TypeScript and local Tailwind CSS, then runs the API and dashboard in one Node service. The Express entry point is also in `src/index.ts` for Vercel detection; Vercel serves `public/` from its CDN. Production startup requires both `SCOUTGUARD_SERVICE_KEY` and `BLOCKSCOUT_API_KEY`; supply them using the deployment platform's secret manager. Do not set `NODE_TLS_REJECT_UNAUTHORIZED=0`. The old static Vercel configuration was removed because it could not serve the API.

The authenticated Ethereum PRO evaluation and public Explorer API comparison were verified locally. The full stack is deployed at [scoutguard.vercel.app](https://scoutguard.vercel.app/). The Sprint 2 public live check, direct USDC path, updated branding, and recorded research replay were verified on the public dashboard on 2026-10-23; see [production evidence](docs/evidence/2026-10-23-sprint2-production.md). The expanded [Craftora project page draft](docs/CRAFTORA_SPRINT2_PROJECT_PAGE.md) awaits the user's publication. Docker image execution and a signing-agent integration were not verified. See [implementation status](docs/SPRINT2_IMPLEMENTATION_STATUS.md) for limits that remain open.

## Hardening branch and verification

The October 23 Sprint 2 production release remains recorded at `aa490c5` (release record `2559de7`). The backend hardening application commit `2a4b170` was pushed with user approval on October 24 to [`feat/scoutguard-sprint2-hardening`](https://github.com/0xNexuz/scoutguard-pro/tree/feat/scoutguard-sprint2-hardening). It has not been merged or deployed to production by this task. It preserves `public/index.html`, `public/app.js`, visual assets and the recorded research case.

See the [security and integration notes](docs/SPRINT2_HARDENING.md), [judge-feedback checklist](docs/SPRINT2_JUDGE_CHECKLIST.md) and [current status](docs/SPRINT2_IMPLEMENTATION_STATUS.md). Defaults scan up to three pages per endpoint and 300 combined records, with ten-second/twelve-call evaluation bounds. Configure history through the engine constructor; public requests cannot raise limits. Full receipts expose a versioned unkeyed SHA-256 envelope and `ReceiptSigner.verifyReceipt`; this verifies digest consistency, not service authenticity. Tests cover tampering and exact transaction binding.

Fresh Blockscout reconstruction and production re-verification are blocked by this cloud's outbound proxy. Fixture tests and local browser checks do not prove live provider access. To attempt the historical case on an allowed network with existing access, run `npx tsx scripts/verify-research-history.ts` once (six calls maximum). No paid plan is needed or authorized for this work. A bounded live scan can legitimately produce FLAG rather than the October 23 preset PASS when coverage is incomplete.

## License

No license file is currently included. Confirm the intended license before public reuse.
