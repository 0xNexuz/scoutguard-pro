# ScoutGuard PRO

ScoutGuard checks a proposed EVM payment **before signing**. Autonomous payment agents and treasury tools can confuse a look-alike address with an intended beneficiary or exceed spending policy. ScoutGuard combines the exact unsigned payment with Blockscout evidence and returns `PASS`, `FLAG` or `BLOCK`. It never holds a wallet, creates a real signature, or broadcasts a transaction.

## Current release and integration state

Production [scoutguard.vercel.app](https://scoutguard.vercel.app) is associated with main `f424779`, including the three-case recorded investigation replay merged in [PR #1](https://github.com/0xNexuz/scoutguard-pro/pull/1). The hardening stream is published separately at `dc179f9`.

This **local** `feat/scoutguard-final-integration` branch consolidates both streams and adds the enforcement adapter, responsive SVG evidence graph, offline icons, mobile fixes and complete verification/submission materials. Application commit `0704e80` has been pushed with user approval. Preview deployment is enabled for the approved release checks; main merge and production status are tracked in `docs/PROJECT_CONTEXT.md`. READY deployment metadata is not proof of anonymous accessibility. Current cloud egress and absent credentials block fresh Blockscout and production verification; fixtures are labeled separately.

Approved release progress and the preview-bootstrap correction are recorded in [release verification](docs/evidence/2026-10-24-approved-release.md).

See the [comprehensive completion report](docs/FINAL_COMPLETION_REPORT.md), [judge verification matrix](docs/FINAL_ACCEPTANCE_MATRIX.md), [release/migration review](docs/RELEASE_MIGRATION.md) and preserved [evidence records](docs/evidence/).

## How it works

`proposed unsigned payment → strict normalization → bounded Blockscout history/recipient/contract evidence → similarity + contract + asset policy checks → decision and receipt → independent agent authorization → isolated signer boundary`

- **Native assets:** positive decimal native amounts on seven configured EVM chains. Ethereum is the historically verified live path; configured does not mean live-verified or plan-accessible.
- **USDC:** only direct canonical `transfer(address,uint256)` on Ethereum (`0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`) and Base (`0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`). The decoded effective recipient is checked separately from the token transaction destination. Base decoding is tested; recorded PRO access to Base returned HTTP 402.
- **Exact amounts:** bigint native units and six-decimal USDC limits. Wrong contracts/chains, malformed calldata, unsupported selectors/transferFrom, native value attached to a token transfer, contradictory assertions, invalid amounts and zero beneficiaries fail closed.
- **History:** API v2 native transactions and ERC-20 event cursors; native/token evidence, deterministic deduplication, hashes/direction/amount/block/time and explicit coverage. Incoming-only and zero-value interactions do not establish outbound references. An event sender need not be the top-level transaction initiator.
- **Similarity:** inspect all distinct references before selecting the strongest. Different addresses with ≥4 matching leading **and** trailing hex characters block. Prefix ≥4 or suffix ≥5 alone requires review. An observed exact address cannot hide a stronger resemblance. Observations never establish verified trust.
- **Policy:** chain permissions, effective-beneficiary allowlists, exact single-payment caps and human-review thresholds. Procurement defaults: ETH/native cap 2.5, review above 1; USDC cap 2,500, review above 1,000. Limits are payment policies, not exchange-rate comparisons.

Missing critical history/provider data returns BLOCK. Valid incomplete history adds review and cannot PASS. Even completed pagination is a statement about these indexed endpoints at lookup time, not proof of complete lifetime activity or address safety.

## Bounded public evaluation

`POST /api/evaluate/public` supports anonymous Ethereum ETH and canonical USDC. The protected `POST /api/evaluate` always requires `x-scoutguard-key`, including development. Absent service-key configuration denies access.

Default scan bounds: 3 pages per endpoint, 300 combined rows, 8 history attempts, 12 overall provider calls, 10-second evaluation deadline, 4-second individual request/body timeout, 2 MB provider responses, and process-wide 250 ms request spacing. Histories can be configured downward through the engine constructor; callers cannot raise HTTP budgets. HTTP clients disconnecting or failed critical checks abort pending/queued provider work.

The public route has 5 requests/minute/client, 20/minute/process, two concurrent evaluations, and a provider-failure cooldown. JSON is limited to 16 KB; compressed requests, unknown fields and coercions are rejected. Results/errors are no-store; provider URLs, headers and raw errors are not exposed. Local controls are not a distributed quota: cold starts and multiple instances remain an operational release limitation. No external store or paid service was provisioned.

## Install and configure

Requires Node.js 22+ and npm. Keep TLS verification enabled.

```bash
npm ci
npm run build
npm test
npm start
```

Open `http://localhost:3030`. The archive and simulations work without provider access. For real checks, copy `.env.example` to `.env` and supply `BLOCKSCOUT_API_KEY` server-side. The server loads dotenv. Set your own long random `SCOUTGUARD_SERVICE_KEY` for protected agent access; production startup requires both keys. A confirmed Vercel preview may omit them to serve the read-only UI; its protected endpoint still returns 401 without a service key. Neither belongs in browser code, screenshots, Git or chat. No private key is required.

The no-key path uses public Explorer APIs, which can deny or time out; those failures BLOCK. The UI distinguishes `BLOCKSCOUT_PRO` and `BLOCKSCOUT_PUBLIC_API`. LIVE means an attempted live evaluation, including a fail-closed outcome; it does not mean a payment occurred.

## API usage

Native candidate (Bash example):

```bash
curl http://localhost:3030/api/evaluate/public \
  -H 'Content-Type: application/json' \
  -d '{"from":"0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be","to":"0x3f8702cfb1662195fcc98593789682da91dfaae3","value":"0.1","chainId":1}'
```

For USDC, `to` is the canonical token contract, `value` is `"0"`, and `data` is ABI-encoded `transfer(beneficiary, rawAmount)`. Construct it with ethers:

```ts
const data = new Interface(['function transfer(address,uint256)'])
  .encodeFunctionData('transfer', [beneficiary, parseUnits('250', 6)]);
const candidate = { from: sender, to: ETHEREUM_USDC, value: '0', data, chainId: 1 };
```

Public responses wrap `evaluation` with `mode` and `source`. Protected responses return the evaluation directly. Results include decision, score, checks, execution permission, receipt and `history.coverage`. The receipt distinguishes effective `to` from original `transactionTo`, records raw amount/native value/calldata, and includes policy/check/coverage fields. Inspect coverage before interpreting any absence of resemblance. The UI presents exact beneficiary, amount, scan bounds and evidence links only when retained data influenced the evaluation.

## Agent enforcement integration

`src/integration/payment-agent.ts` exports `createServiceEvaluator`, `assertEvaluationBinding` and `runPaymentAgent`. Use the protected HTTPS endpoint from a trusted server process, with a service key from its secret manager. The adapter checks receipt consistency, agent/exact transaction binding, check/decision/permission agreement, complete history and 30-second freshness (rechecked after downstream approval). BLOCK aborts, FLAG leaves the path for explicit review and fresh evaluation, and PASS requires a separate `authorize` callback.

Run the isolated, network-free example:

```bash
npm run demo:agent
```

Expected synthetic outcomes: 250 USDC → mock SIGNED; 1,500 → REVIEW_REQUIRED; 3,000 → BLOCKED. Only the first reaches a mock signer returning a non-transaction string. No real wallet, signed EVM bytes or broadcast is involved. Modified/stale responses and provider errors never sign. The helper is repository code, not a published SDK.

The SHA-256 digest is **unkeyed**, not an authenticated signature. A forged response can recompute it. Trusted transport and independent authorization are essential; the helper is not a replacement for wallet chain/sender/nonce/gas controls, idempotency, an execution ledger, or a real human-approval system. Real-wallet enforcement is unverified. Hourly executed-spend accounting is explicitly unsupported; unsigned evaluations are never counted as spending.

## Investigation replay and evidence

The five-stage player shows candidate → retained Blockscout evidence → relationships → check contributions → verdict, with play/pause/restart, previous/next, speed, progress, reduced motion and keyboard graph selection. Solid and dashed edges distinguish observed events and proposed unsigned payments. The three unchanged archived cases support two address nodes; no extra network or victim is invented. Downloads remain **partial receipt transcriptions** with missing exact times/IDs disclosed.

Categories are separate: LIVE evaluation, RECORDED live evaluation, RECORDED research replay and SIMULATED scenario. [The Poison-Hunter case](docs/evidence/2026-10-23-recorded-poisoning-replay.md) demonstrates conditional resemblance with a research-supplied reference. Improved live recovery of that reference has not been verified here, and no historical loss prevention is claimed.

The opt-in `npx tsx scripts/verify-research-history.ts` performs at most six read-only requests/300 rows in ten seconds on a permitted network. It does not inject the known reference into live discovery. Do not retry without another defined budget or purchase chain access.

## Verification, browser checks and demo

```bash
npm run build
npm test
npm run typecheck
npm audit --audit-level=high
npm run demo:agent
npm run test:browser
```

Browser verification uses `playwright-core` and an existing Chromium executable (`CHROMIUM_PATH` when needed), never a paid service. It starts a loopback fixture server, blocks external resources and labels synthetic provider data. It covers ETH/USDC, cap/partial/outage/rate errors, exact output fields, every replay stage, evidence relationships/download, simulations, keyboard controls, reduced motion, bad archives and 320/390/768/1280px layouts. It is not live Blockscout proof. No critical tests are intentionally skipped.

`npm run record:demo` additionally needs ffmpeg. It captures 100 seconds of the real local app's static recorded cases and labeled simulations, with captions and no live evaluation/provider calls. It writes intermediate files under `work/demo-recording/`. [Narration and storyboard](docs/demo/FINAL_DEMO.md), [judging walkthrough](docs/demo/JUDGE_WALKTHROUGH.md) and [submission checklist](docs/demo/SUBMISSION_CHECKLIST.md) are ready for review, not external submission.

## Deployment and release limits

Vercel uses the Express default export and serves public assets; Docker builds the same TypeScript app and runs as a non-root user. Both keep the existing frontend identity and local assets; icon behavior has no CDN dependency. Remote fonts are optional with fallbacks. Docker can accept a public proxy CA via a temporary BuildKit `proxy_ca` secret; it is never copied into image layers. Never disable TLS validation.

No production secrets were read or modified. Read the [migration and release checklist](docs/RELEASE_MIGRATION.md) before an approved deployment: receipt v1.3 and enforcement clients must move together; v1.2 archived records cannot authorize current execution. Current-branch GitHub Actions and production behavior require verification after an approved push/deployment. The live historical reconstruction, anonymous production flows/Explorer destinations, shared deployment quota and real wallet enforcement remain gates; local test success alone does not close them.

## License

No project LICENSE file is included. Confirm intended licensing before redistribution.
