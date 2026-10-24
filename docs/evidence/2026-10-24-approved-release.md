# Approved integration release — 2026-10-24

The user approved release after reviewing local integration `0704e80`. That commit was pushed to `feat/scoutguard-final-integration`, and [PR #2](https://github.com/0xNexuz/scoutguard-pro/pull/2) opened against unchanged main `f424779`. Preview deployment was explicitly enabled at `57fb3b1`. No force push, production-secret change, purchase, wallet action, Craftora submission or social publication was performed.

## Checks before merge

GitHub Actions PR run [40117542122](https://github.com/0xNexuz/scoutguard-pro/actions/runs/40117542122) succeeded for the initial release revision. Vercel marked preview `dpl_3pETJmXw8fzpPpja3yQ1N2kTBDRE` READY at the same revision. However, Vercel-assisted root/health requests returned HTTP 500/FUNCTION_INVOCATION_FAILED. Scoped runtime logs identified `SCOUTGUARD_SERVICE_KEY is required in production` in the preview environment. READY was therefore not treated as runtime verification.

The fix permits credential-free read-only startup only for confirmed Vercel previews (`VERCEL=1`, `VERCEL_ENV=preview`). Protected evaluation remains 401 unless its service key is configured. Production/unconfirmed environments still require both keys, and the TLS guard is unchanged. No production key was copied into preview and no key value was retrieved.

Local verification after the fix: **139 tests passed, 0 failed/skipped/canceled; 25 browser checks passed; build and strict types passed; npm audit reported zero findings**. Four process-isolated tests specifically cover preview startup, production/unconfirmed missing service key, missing production provider key and configured-production authentication.

Updated remote CI, preview runtime inspection, merge and production deployment status are recorded below as they are completed. Authenticated Vercel-assisted requests are not anonymous browser proof. Fresh Blockscout reconstruction and direct anonymous access remain limited by this cloud's enforced network policy and absent provider credentials; no successful fresh provider check is claimed. Distributed quota, real-wallet enforcement, authenticated signatures and authoritative hourly accounting remain disclosed limitations.
