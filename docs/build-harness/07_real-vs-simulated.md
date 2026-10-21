# Real vs simulated

| Capability | Status | Evidence |
|---|---|---|
| TypeScript engine and local server | REAL — LOCAL | Build, tests, local HTTP checks |
| Five dashboard scenarios | SIMULATED | Fixture-backed `/api/simulate/:scenarioId` |
| Live Blockscout evaluation | REAL — LOCAL, ETHEREUM | Authenticated PRO-backed evaluation returned `PASS` on chain 1; see dated evidence |
| Authenticated PRO gateway | VERIFIED — LOCAL, ETHEREUM | Address detail and counters returned HTTP 200; Base returned plan-related HTTP 402 |
| Deployed app | REAL — PUBLIC MVP | Production Vercel URL passed health, simulation, auth, live Ethereum evaluation, and browser interaction checks on 2026-10-21 |
| Receipt digest | REAL — LOCAL | SHA-256 over selected evaluation fields; not signed/on-chain |
| Hourly volume and human approval workflow | NOT IMPLEMENTED | Policy field and `FLAG` response only |

The UI labels demo results `SIMULATED`. Explorer links identify addresses and are not evidence that ScoutGuard sent a transaction.
