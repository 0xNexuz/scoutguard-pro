# Final judge-facing verification matrix — 2026-10-24

> **Historical release snapshot.** The 25 October judging upgrade has newer fresh-provider evidence and 150 automated/26 browser checks. Use [Sprint 2 judging evidence](submission/JUDGING_EVIDENCE.md) for current status; this matrix is retained to preserve the earlier release record.

Branch `feat/scoutguard-final-integration` consolidates main `f424779` and hardening `dc179f9` and was released through PR #2 at application merge `160fff4`. Latest 139-test CI/deployment evidence is in [approved release verification](evidence/2026-10-24-approved-release.md). Local verification is distinct from the existing production release, recorded evidence, and blocked external checks. “Verified local” does not mean deployed or measured security efficacy. See the comprehensive completion report for exact final counts.

## Five judge requests

| Requirement | Code location | Tests | Live evidence | Limitation | Status |
|---|---|---|---|---|---|
| Genuine canonical USDC payment evaluation | `src/core/payment-normalizer.ts`, `scoutguard.ts`, `policy-engine.ts` | `security.test.ts`, original invariants, `agent.test.ts`, browser USDC/cap checks | Preserved October 23 direct-USDC production record | Approved application deployed; fresh provider/anonymous checks remain open; Base access historically 402; no general token/transferFrom support | VERIFIED LOCAL + RECORDED LIVE; fresh external check BLOCKED |
| Automatic counterparty discovery | `src/core/blockscout-client.ts`, `provider-budget.ts`, `poisoning-detector.ts` | `history.test.ts`, security ordering/coverage/cancellation tests | Preserved genuine event and sender-history records | Improved historical reference recovery unavailable in this cloud; indexed bounded scan excludes internal transfers | VERIFIED LOCAL; fresh provider access BLOCKED |
| Public real Blockscout-backed checks | `src/index.ts`, `public/app.js` | Loopback API/auth/body/abuse tests; browser form/partial/outage/migration checks | Original public evaluator production evidence; READY main metadata | Current branch's anonymous production behavior not checked; distributed quota unsupported | VERIFIED LOCAL + RECORDED LIVE; release gate OPEN |
| Evidence-backed outcomes and investigation playback | `public/replay*.js`, `replay.css`, `replay/records.json` | Original replay tests + graph/classification tests; browser 3×5 stages, graph keyboard, download, errors | Three unchanged partial production transcriptions with retained Explorer hash | Old records lack exact times/IDs; digest unkeyed; no live Poison-Hunter prevention claim | VERIFIED LOCAL + PRESERVED RECORDED EVIDENCE |
| Clear detailed explanation | README, Craftora draft, report, migration notes and demo docs | Documentation/source reconciliation and executable reproduction commands | Original evidence links retained | Draft not submitted; deadlines/rules require fresh external confirmation | PREPARED LOCALLY; external publication NOT DONE |

## Final acceptance gates

| Requirement | Code location | Tests | Live evidence | Limitation | Status |
|---|---|---|---|---|---|
| Preserve both streams and Git history | Local integration merge; original archive/evidence | Combined baseline 110 tests; original archive/evidence no diff against main | PR #1 merged; main/hardening CI success independently inspected | Desktop-local files inaccessible; no claims about their content | VERIFIED LOCAL |
| Strongest relevant resemblance | Poisoning detector | Exact/weak/strong reorder, duplicate, prefix/suffix and published address case tests | Conditional Poison-Hunter resemblance only | Heuristic, not calibrated probability | VERIFIED LOCAL |
| Honest coverage/conservative partial policy | History/engine + live coverage renderer | Empty/partial/old pages, malformed/repeated cursors, limits, 402/429/timeouts | Historical sender/event data retained | No exhaustive lifetime/index guarantee | VERIFIED LOCAL; fresh access BLOCKED |
| Exact recipient/amount/chain/asset | Payment normalizer and policy | Ethers calldata, uint256/precision, zero/wrong contract/chain/assertion boundaries | Recorded direct-USDC path | Canonical Ethereum/Base only | VERIFIED LOCAL |
| Provider failure/cancellation cannot authorize | Provider budget, engine and API disconnect propagation | Critical failure, pre-abort, client disconnect and no extra queued requests | Network probes denied before provider | Genuine current provider statuses unavailable | VERIFIED LOCAL |
| Public/private endpoint isolation | Express auth/validation/limits | Missing/wrong/absent/correct keys, size/JSON/compression/coercion, IP/aggregate/concurrency/cooldown | Old protected/public production observations | Shared store not configured; local controls only | VERIFIED LOCAL; operational limit OPEN |
| Correct receipt binding | Receipt module and agent adapter | JSON round-trip, 18 field changes, agent/transaction/check/action/freshness disagreements | Old digests kept as historical partial records | Unkeyed consistency only; no authenticated authorization | VERIFIED LOCAL |
| Agent enforcement | `src/integration/payment-agent.ts`, `examples/mock-agent.ts` | PASS + separate authorization; FLAG/BLOCK/outage/mutation/expiry never sign | No real-wallet claim | No real signer/broadcast; wallet nonce/gas/idempotency remain downstream | VERIFIED LOCAL MOCK |
| Evidence-backed graph | Replay graph/model | Exactly two supported nodes, solid/dashed edges, evidence details, no duplicate events, incoming semantics | Same retained transaction hash | No invented relationships or new archive cases | VERIFIED LOCAL |
| Accessible replay controls | Replay player/CSS/HTML | Five stages, progress, speed, pause/restart/navigation, keyboard/reduced motion | Three original archived decisions | Manual usability checked locally, no broad assistive-technology study | VERIFIED LOCAL |
| Mobile/desktop resilience | Polish CSS, inline icons, wrapping | 320/390/768/1280px no overflow; form use, downloads, no runtime exceptions with external assets blocked | No new production browser observation | Optional fonts unavailable; fallbacks verified | VERIFIED LOCAL |
| Combined build/test/audit | npm scripts, pinned read-only Verify workflow | Full final command log and browser JSON | Historical branch Actions runs successful | Release main Actions run 40118199496 passed; see release evidence | VERIFIED LOCAL + RELEASE CI PASSED |
| Deployment compatibility | Express default export, Dockerfile, Vercel branch guard | Build and non-root network-isolated container smoke; production startup guards | READY production main metadata | Application deployment approved and completed; anonymous/provider checks remain open | DEPLOYED; QUALIFIED GET CHECKS PASSED |
| Documentation and demo | README, demo scripts/storyboard, Craftora draft | Runnable mock/browser/recording scripts; MP4 duration checked | Recorded-only walkthrough, no new live checks | No narration audio or external video/submission publication | PREPARED LOCALLY |

## Readiness interpretation

The defined implementation work is consolidated and reproducible locally. Four external verification dependency groups remain unverified here: fresh Blockscout APIs, anonymous deployed HTTP flows, Explorer destination content, and optional remote font delivery. Production scale also needs a shared quota; executed-hourly accounting and real-wallet enforcement are explicitly unsupported. These are disclosed instead of counted as completed. No 95% overall completion or official judging score is claimed.
