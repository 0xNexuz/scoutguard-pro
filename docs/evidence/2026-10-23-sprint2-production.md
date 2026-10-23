# Sprint 2 production verification — 2026-10-23

GitHub commit [`aa490c5`](https://github.com/0xNexuz/scoutguard-pro/commit/aa490c5bd61b13887fe38049daa83c9728d23415) was pushed to `main`. The connected Vercel project automatically built it as [deployment `ALxkjdBvRyQ11SR4ot3BeGgDF75X`](https://vercel.com/xreyys-projects/scoutguard/ALxkjdBvRyQ11SR4ot3BeGgDF75X). The Vercel deployment page displayed **Ready**, **Production**, branch `main`, and that commit.

The public URL [scoutguard.vercel.app](https://scoutguard.vercel.app/) was checked through the browser after the deployment. Results:

| Check | Observed result |
|---|---|
| `/api/health` | `status: ONLINE`, `blockscoutIntegration: REQUEST_SCOPED` |
| Dashboard | New live form, logo, TypeScript direct-transfer example, and recorded research replay present |
| Public 250 USDC direct transfer preset | `LIVE · BLOCKSCOUT_PRO · PASS`; recipient-history, EOA, canonical USDC, and policy checks passed; Blockscout sender, recipient, historical transfer, and token-contract links present |
| Public 3,000 USDC direct transfer preset | `LIVE · BLOCKSCOUT_PRO · BLOCK`; `SEC-POLICY-CAP` failed against 2,500 USDC hard limit |
| Recorded poisoning replay | `RECORDED_RESEARCH_REPLAY · BLOCK`; 4 matching prefix and 4 suffix hex characters, with Blockscout transaction and Poison-Hunter source links. The page states that recent live history did not recover the older reference. |

The browser viewport was narrow during the checks; the form, result, and replay were readable without a horizontal layout break. No transaction was signed or broadcast. The public checks do not demonstrate a live detection of the older poisoning case, a real signing-agent integration, a deployment-wide quota, or hourly policy enforcement. See [implementation status](../SPRINT2_IMPLEMENTATION_STATUS.md).
