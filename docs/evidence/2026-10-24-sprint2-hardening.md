# Cloud Sprint 2 hardening verification — 2026-10-24

Dates in this record use Africa/Lagos; the cloud host reports UTC on October 23 during the same session. This records local work, not a new production deployment.

## Starting state and existing work

- Starting branch `work`, clean at `2559de7a4815986eeb496bf217780b428a4eb890`.
- `git fetch origin` confirmed the same latest `origin/main`; recent history includes `aa490c5` and the production release record `2559de7`. Only remote main was present.
- Branch created: `feat/scoutguard-sprint2-hardening`; no history rewritten and no remote mutation.
- Existing direct USDC support, exact calldata normalization, asset limits, first-page history, anonymous Ethereum evaluator, real-data evidence, sourced research replay, Craftora draft and recorded production verification were inspected and extended, not rebuilt.
- Baseline `npm test`: **24 passed**, 0 failed. Earlier documents' 21-test count was stale.
- `AGENTS.md` and the requested project/status/evidence records were read. The gap analysis was written before edits; its findings are consolidated in `../SPRINT2_HARDENING.md`.

## Newly implemented fixes

| Finding | Fix | Verification |
|---|---|---|
| First-page-only sender discovery | Bounded API v2 cursor traversal; native/token sources alternate; explicit coverage and event evidence | `test/history.test.ts`: older reference recovery across pages, deterministic cursors, row/page/call/time/age bounds, malformed/repeated cursors |
| Duplicate events and ambiguous relationships | Chain/hash/token/log deduplication; outgoing native vs token event semantics; incoming/zero/self excluded from references | History fixtures include repeated peers, distinct token contracts/log indexes, incoming spam and zero events |
| Valid partial data could imply clean history | Critical first-page failure BLOCK; partial coverage WARN/FLAG or stronger decision; machine-readable errors retained | History and security tests cover missing/empty/partial data, 402, 429, 503 and timeout |
| Early weak/exact match masks stronger resemblance | Full reference scan, deterministic severity ordering and tie breaks | Security tests cover reordered/duplicate sets, observed exact before CRITICAL, prefix-only, suffix-only and unrelated similarity |
| Missing payment assertion/zero-value rules | Reject contradictory raw/destination/value assertions, zero recipients/amounts, native uint256 overflow; retain strict ABI USDC scope | Ethers ABI tests and one-smallest-unit policy boundary checks |
| Recipient allowlist configuration ignored | Enforce against effective beneficiary | Explicit USDC allowlist test |
| Provider errors could reveal raw messages/credentials | Central bounded requester, sanitized status codes and fixed engine/HTTP failures | Mock credential-bearing errors never appear in results; no provider keys embedded in output |
| Public abuse costs insufficiently bounded | Per-process aggregate limit/concurrency/cooldown, shared per-process provider spacing, evaluation budgets and sibling cancellation | Real loopback HTTP limit/concurrency tests and abort-aware provider tests |
| Input coercion/parser exposure | Strict typed fields, unknown-field rejection, bounded strings, no compression, structured parser errors, forwarded-IP policy | HTTP tests include malformed/oversized/compressed requests, forged forwarded IP and no provider calls on invalid candidates |
| Receipt could not be independently reconstructed | Full versioned envelope, stable canonical SHA-256 and verifier | JSON round-trip succeeds; eighteen independent field mutations fail verification |
| Dependency advisory | body-parser 1.20.8 → 1.20.9 only | npm audit: zero known vulnerabilities; GHSA-27r3-jxmh-p828 no longer present |
| Stale release documents | Distinguish October 23 shipped baseline from local hardening, consolidate judge checklist, expand Craftora draft | Manual document/code reconciliation; no publication |

## Final automated checks actually run

| Command | Result |
|---|---|
| `npm ci` | Exit 0; 147 packages added |
| `npm run build` | Exit 0; TypeScript and Tailwind completed |
| `npm test` | Exit 0; **106 tests, 106 pass, 0 fail/cancel/skip** |
| `npx tsc --noEmit` | Exit 0 |
| Strict TypeScript check of tests, fixtures and opt-in script using NodeNext/ES2022 | Exit 0 |
| `npm audit --json` | Exit 0; 0 info/low/moderate/high/critical advisories |
| `node --check public/app.js` | Exit 0; unchanged frontend syntax valid |
| `git diff --check` | Exit 0; no whitespace errors |

The first final run passed 105 tests. A subsequent review added cancellation of sibling provider work and its regression test; the complete final sequence above passed 106. This is engineering test evidence, not live API proof or a judging score. Tailwind regenerated a machine-specific stylesheet during verification; the original checked-in asset was preserved, so public files have no diff.

## Historical coverage and poisoning verification

Defaults: three pages per endpoint, 300 combined inspected rows, eight history request attempts, ten-second history/evaluation deadline, twelve overall evaluation calls, four-second individual request/body timeout, 2 MB provider responses, 250 ms process-wide request spacing. Optional age limits are disclosed. Returned counts, classifications and provenance are described in `../SPRINT2_HARDENING.md`.

Older native counterparties were recovered across mocked API pages. Duplicate transfers did not inflate relationship counts. Incoming-only or zero-value events did not establish a comparison reference. Incomplete history could not PASS, even for a configured exact payee. High-confidence resemblance always blocked; ambiguous resemblance required review. Exact observations were not promoted to verified trust.

The published Poison-Hunter attacker/reference still produce a conditional 4+4 critical resemblance. The original recorded evidence is untouched. No successful new live reference recovery, attack prevention or efficacy measurement is claimed.

## USDC and HTTP regression results

Canonical direct USDC transfer still passes when complete fixture data and policy permit it. Beneficiary counters/details are fetched for the calldata recipient, and canonical/source checks target the token contract. Native transfers remain supported. Tests reject transferFrom/approve, token/chain mismatches, nonzero native value, malformed/noncanonical calldata, false raw assertions, invalid/zero recipients and amounts; max uint256 USDC is handled exactly and blocked by cap. Boundaries at 1,000 and 2,500 USDC plus one smallest unit behave as PASS/FLAG/BLOCK policy requires. Source-unverified/unavailable token metadata cannot PASS. Base decoding is tested without implying live Base access.

Anonymous loopback ETH and USDC requests work with fixture providers. Missing/wrong protected service keys return 401; correct key works and absent configuration denies access. Per-client/aggregate/concurrency rejection, no-store, 16 KB/compression limits, cooldown and sanitized provider failure were verified. All five simulations keep SIMULATED labels; research keeps RECORDED_RESEARCH_REPLAY. No receipt is an authenticated signature or authorization to sign a different transaction.

## Browser and genuine network observations

Local Chromium used synthetic provider methods and blocked all external resources. ETH and USDC candidates displayed FLAG plus incomplete-history review, 3,000 USDC displayed BLOCK, expected address links were constructed, invalid input displayed an error, and injected 503/429 responses displayed errors. Research rendered its separate provenance and live-coverage limitation. This does not establish Blockscout access or verify Explorer destination pages.

At a 390px mobile viewport, document width measured approximately 398–401px; blocked `unpkg.com` caused `lucide is not defined`. The app form checks still completed. No frontend fix or design change was attempted in this backend branch.

Defined live access probe budget: one production HEAD and one Blockscout history HEAD, each with 15-second timeout; no retries and no key. Both returned a proxy CONNECT 403 before reaching the destination:

- `https://scoutguard.vercel.app/`
- `https://eth.blockscout.com/api/v2/addresses/0x3e14605bf3ebc239a6ba1fdd4cd9daf01f382faf/transactions`

These are network-policy denials, not provider response schemas, plan failures or Vercel authentication results. No successful fresh Blockscout data was observed. Improved-scanner reconstruction and fresh anonymous production verification are BLOCKED. The opt-in script provides a reproducible six-request read-only reconstruction on an allowed network; it was not used to bypass this restriction. Recorded October 23 production evidence remains valid only for its listed historical checks.

## Files, remaining limits and release gates

Modified existing files: `.gitignore`, `README.md`, `docs/PROJECT_CONTEXT.md`, `docs/SPRINT2_IMPLEMENTATION_STATUS.md`, `docs/CRAFTORA_SPRINT2_PROJECT_PAGE.md`, `docs/build-harness/12_submission-map.md`, `package-lock.json`, six existing core files (`blockscout-client`, `payment-normalizer`, `poisoning-detector`, `policy-engine`, `receipt-signer`, `scoutguard`; the contract gate is unchanged), `src/index.ts`, `src/types/index.ts`, and `test/scoutguard.test.ts`.

New files: `src/core/provider-budget.ts`, `test/history.test.ts`, `test/security.test.ts`, `test/api.test.ts`, `test/fixtures/blockscout.ts`, `scripts/verify-research-history.ts`, `docs/SPRINT2_HARDENING.md`, `docs/SPRINT2_JUDGE_CHECKLIST.md`, and this evidence record. Scratch scripts/logs/screenshots are ignored under `work/`.

No diff to `public/index.html`, `public/app.js`, `public/styles.css`, design assets, or original recorded evidence. Potential PC integration conflicts are limited primarily to `src/index.ts` if that task changes research/API routes, `src/types/index.ts` if it adds evidence types, receipt consumers and shared documentation. Additive read fields remain compatible; constructing new typed receipts now requires the version/check fields. Do not overwrite a dirty PC working tree or rebuild its graph. No PC-local changes were recovered.

Outstanding: shared deployment-wide quota (documented $0-budget proposal, no service provisioned), fresh live and anonymous production checks, genuine historical reference recovery, real signer/freshness enforcement, authenticated receipts, hourly accounting, labeled-dataset efficacy, video and user-owned Craftora/showcase publication. Internal transfers and full lifetime graph completeness are outside the history scan. Existing frontend external-asset/mobile observations remain recorded limitations.

Use `../SPRINT2_JUDGE_CHECKLIST.md` for the updated judge request / implementation / verification / evidence / limitation mapping. Local correctness and reproducibility are substantially stronger, but full end-to-end critical verification and the requested 95% overall completion cannot be substantiated with the remaining gates. No official score is claimed.

Push, merge, deployment, paid infrastructure, production-secret changes, payment signing/broadcasting and publication were not performed. Next external actions require user approval after reviewing this branch and report.
