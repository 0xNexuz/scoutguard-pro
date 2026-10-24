# Approved integration release — 2026-10-24

The user approved release after reviewing local integration `0704e80`. That commit was pushed to `feat/scoutguard-final-integration`, and [PR #2](https://github.com/0xNexuz/scoutguard-pro/pull/2) opened against unchanged main `f424779`. Preview deployment was explicitly enabled at `57fb3b1`. No force push, production-secret change, purchase, wallet action, Craftora submission or social publication was performed.

## Checks before merge

GitHub Actions PR run [40117542122](https://github.com/0xNexuz/scoutguard-pro/actions/runs/40117542122) succeeded for the initial release revision. Vercel marked preview `dpl_3pETJmXw8fzpPpja3yQ1N2kTBDRE` READY at the same revision. However, Vercel-assisted root/health requests returned HTTP 500/FUNCTION_INVOCATION_FAILED. Scoped runtime logs identified `SCOUTGUARD_SERVICE_KEY is required in production` in the preview environment. READY was therefore not treated as runtime verification.

The fix permits credential-free read-only startup only for confirmed Vercel previews (`VERCEL=1`, `VERCEL_ENV=preview`). Protected evaluation remains 401 unless its service key is configured. Production/unconfirmed environments still require both keys, and the TLS guard is unchanged. No production key was copied into preview and no key value was retrieved.

Local verification after the fix: **139 tests passed, 0 failed/skipped/canceled; 25 browser checks passed; build and strict types passed; npm audit reported zero findings**. Four process-isolated tests specifically cover preview startup, production/unconfirmed missing service key, missing production provider key and configured-production authentication.

Updated remote CI, preview runtime inspection, merge and production deployment status are recorded below as they are completed. Authenticated Vercel-assisted requests are not anonymous browser proof. Fresh Blockscout reconstruction and direct anonymous access remain limited by this cloud's enforced network policy and absent provider credentials; no successful fresh provider check is claimed. Distributed quota, real-wallet enforcement, authenticated signatures and authoritative hourly accounting remain disclosed limitations.


## Approved application release and qualified verification

- Corrected revision `970e4b7` passed [PR CI run 40117989436](https://github.com/0xNexuz/scoutguard-pro/actions/runs/40117989436). GitHub reported PR #2 mergeable and Vercel reported the corrected preview READY.
- Corrected preview `dpl_7pacCnZpVBJvtkc2QV14N6qUrY8T` returned HTTP 200 for `/api/health`, `/`, `/replay/records.json` and `/replay-graph.js` through authenticated Vercel-assisted access. Root included playback speed, offline icons and the enforcement example; the archive retained PASS/PASS/BLOCK.
- PR #2 merged normally with an expected-head check to application commit `160fff45882ecb7249b762cc49e70664ce106a4f`; no history rewrite or direct main commit occurred.
- [Main CI run 40118199496](https://github.com/0xNexuz/scoutguard-pro/actions/runs/40118199496) succeeded. Its job 120943854843 logs explicitly record 139 tests/pass, zero fail/cancel/skip, successful browser checks and zero vulnerabilities.
- Vercel deployed application main `160fff4` as READY production `dpl_6cmW1jiqamCuu1k3517MfbhMohVb`, with alias scoutguard.vercel.app.

| Production path checked through Vercel-assisted access | Result |
|---|---|
| `/api/health` | 200 / ONLINE; unsupported capability flags remain false |
| `/` | 200; replay, speed control, local icons and enforcement example present |
| `/replay/records.json` | 200; unchanged three RECORDED_LIVE_EVALUATION records with PASS/PASS/BLOCK |
| `/replay-graph.js` | 200; responsive SVG renderer present |

These are authenticated deployment-content/runtime checks, not anonymous browser tests. They made no Blockscout evaluation requests or blockchain transactions. The source-mode and startup corrections were verified locally and in CI; fresh deployed ETH/USDC/reconstruction and Explorer destination checks remain open. Subsequent documentation-only commits record this release without changing runtime code. See matching JSON for sanitized observations; no share tokens, headers, key values or production secrets are included.
