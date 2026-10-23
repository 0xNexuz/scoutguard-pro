# Consolidated judge-feedback checklist — 2026-10-24

This is the current checklist for the five recorded judge requests. October 23 production evidence refers to the released baseline; new hardening is locally verified and pending review/approved release. Mocked and browser-fixture tests are not live provider proof.

| Judge request | Implementation | Verification | Evidence | Remaining limitation |
|---|---|---|---|---|
| Genuine USDC support | Existing canonical direct-transfer decoder, effective beneficiary checks and six-decimal limits retained; contradictory assertions, zero/invalid amounts and malformed calldata rejected. | Published baseline USDC PASS/cap BLOCK; current ethers-encoded adversarial and policy-boundary tests pass. | `src/core/payment-normalizer.ts`, `test/security.test.ts`; `evidence/2026-10-23-sprint2-production.md` | Current branch not deployed; Base historically HTTP 402; no general ERC-20 registry or transferFrom. |
| Automatic counterparty discovery | New bounded API v2 pagination, deduplication, relationships, event evidence and coverage; partial-history review. | Older fixture references recovered; incoming/zero-value excluded; 402/429/timeouts/cursors/budgets tested; stronger later collisions selected. | `test/history.test.ts`, `test/security.test.ts`, `SPRINT2_HARDENING.md` | Genuine research reference recovery blocked by cloud egress; no exhaustive lifetime graph or inferred trust. |
| Public live evaluator | Existing anonymous Ethereum route retained; stricter validation, process aggregate/concurrency/cooldown/provider budgets; protected endpoint remains keyed. | HTTP guest ETH/USDC, auth, invalid/oversized/compressed input, secret redaction, limits and simulated availability failures pass. | `test/api.test.ts`; historical production record; security notes | No shared store; fresh anonymous production verification blocked. Local fixture checks cannot establish live accessibility. |
| Real Blockscout evidence | Released live evidence and separate sourced research replay preserved; new typed event/coverage data and complete receipt envelope. | Research addresses still produce 4+4 critical resemblance conditionally; exact evidence-link selection and receipt tampering tested; form renders review warnings. | Unchanged `evidence/2026-10-23-recorded-poisoning-replay.md`, October 23 production record; `test/security.test.ts` | No new successful live observation; no claim of historical prevention; unkeyed digest does not authenticate service. |
| Expanded Craftora page | Draft explains problem/users/solution, load-bearing Blockscout, direct USDC, discovery, decisions, reproduction, architecture, evidence, limits and roadmap. | Manually reconciled shipped baseline with local branch and evidence categories. | `CRAFTORA_SPRINT2_PROJECT_PAGE.md` | Not published; user retains video/submission/showcase. No adoption or measured security-effectiveness claims. |

## Critical acceptance and rubric assessment

| Acceptance area | Local evidence | Status / release gate |
|---|---|---|
| Exact intended native/USDC payment, fail closed | Normalizer/engine tests, ethers ABI fixtures and exact integer boundary tests | VERIFIED locally; unchanged supported scope. Real wallet integration still absent. |
| Bounded history and coverage honesty | Cursor/budget/error fixtures, older reference and partial/empty tests | VERIFIED locally; live schema/access confirmation pending permitted network. |
| Strongest-match poisoning behavior | Ordering, duplicates, exact-vs-critical, prefix/suffix, empty/invalid references and published address case tests | VERIFIED locally; no probability/efficacy claim. |
| HTTP auth, cost bounds, no secrets | Loopback HTTP tests plus sanitized errors and body-parser patch | VERIFIED locally; distributed quota remains open. |
| Receipt field consistency | JSON round-trip and eighteen field mutations | VERIFIED digest consistency; not authenticated authorization. |
| Anonymous production, live historical recovery | Only preserved October 23 observations; current CONNECT proxy 403 | BLOCKED for new release. Do not count fixtures as meeting this gate. |
| Frontend/PC task isolation | No diff to public frontend/assets or original evidence | VERIFIED locally; API/type integration may need coordination with PC work. |

The recorded rubric weights are Blockscout integration 30%, utility 20%, technical execution 20%, creativity 15%, UX/demo 10% and showcase 5% (brief last checked October 20). Core implementation has stronger local evidence, but current production verification, live reference recovery, distributed quotas, signer integration, demo and publication are not complete. User validation and measured detection performance are absent. No official judging score or 95% completion claim is justified. Review the branch and resolve the release gates before presenting the hardening as deployed.
