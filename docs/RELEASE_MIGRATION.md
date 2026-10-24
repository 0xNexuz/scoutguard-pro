# Integrated release and receipt migration review

This integration is local on `feat/scoutguard-final-integration`, from main `f424779` plus hardening `dc179f9`. It is not a main merge or deployment. Preserve the three-case archive and all original evidence. Do not force-push or overwrite desktop work.

## Compatibility review

| Surface | Change | Migration behavior |
|---|---|---|
| Public/protected routes | Existing request/response envelopes retained; strict types/unknown-field checks; protected route now always requires key | Ensure the server key is set even for local protected examples. Anonymous judges use `/api/evaluate/public`. |
| History | Additive `history` evidence/coverage; partial scans require FLAG or BLOCK | A formerly passing high-activity preset can require review when bounded coverage is incomplete. This is deliberate, not a failed token decoder. |
| Receipt | `v1.3.0-sprint2-hardening`, full checks/coverage, algorithm label and deterministic verifier | New enforcement adapter rejects legacy receipts. Upgrade API and verifier together; do not recompute old recorded hashes as new receipts. |
| Agent response | Permission, action, score and checks must agree; exact candidate/agent/coverage/freshness binding | Do not use unkeyed digest as authentication. Require trusted HTTPS, downstream authorization and wallet-specific chain/nonce/gas/idempotency controls. FLAG has no automatic override. |
| Browser | Current live UI refuses legacy receipt schemas and incomplete PASS; clears old result on a new attempt | Deploy UI/API atomically and verify CDN assets match the reviewed release. Archived v1.2 partial records continue through the separate replay path. |
| Recorded archive | Unchanged three partial transcriptions, date-only times/unknown IDs | Not a source of current authorization or reconstructed original receipts. The archive validator checks structural/decision consistency, not authenticated historical truth. |
| Policy | Single-payment checks only; hourly legacy config remains explicitly unenforced | No executed-payment source exists. Do not count evaluations as spending or advertise hourly protection. |

## Required release procedure

1. Review the final diff, matrix, report and local evidence. Confirm main has not advanced or acquire/review newer changes without overwriting local work.
2. Obtain explicit approval before pushing this integration branch. Its `git.deploymentEnabled` setting is false to avoid automatic previews from an ordinary review push. No release action is currently authorized.
3. Run the combined checks from README on the exact proposed commit. The current GitHub Actions workflow includes type, unit/HTTP, isolated agent and browser checks with read-only permissions and pinned actions. Local success is not a remote Actions run.
4. Before an approved preview, deliberately enable the intended branch/deployment path and use existing server-side credentials; no secret change is required by this code. Do not purchase a plan or expose values. Preserve TLS verification.
5. On the approved preview, verify anonymous root/assets, guest ETH/USDC, cap BLOCK, invalid/partial/provider behavior, auth boundaries, coverage, exact Explorer destinations, replay/download and mobile layout. Exercise failure/rate tests in isolated preview, not by exhausting production quota.
6. Perform at most one planned, bounded genuine Ethereum history reconstruction with authorized access. Record sanitized coverage and whether the research reference is actually returned; failure to recover must remain explicit.
7. A deployment-wide quota is required before scaled public traffic. The current account's project-integration listing returned no configurations, and this cloud has no store credentials. Use the documented free-budget proposal only after verifying terms; no infrastructure was provisioned. Consider restricting public scale until this gate is resolved.
8. Obtain approval before merging main or deploying/promoting production. Verify the exact team/project/commit/environment and then repeat anonymous production checks with normal TLS. READY alone is insufficient.
9. Preserve rollback to the prior reviewed release. Never treat prior PASS receipts as current approvals; wallet callers must keep their own freshness/idempotency controls during rollout and rollback.
10. Craftora submission, video publication and social posts remain separate user-owned actions.

## Security limits remaining

Unkeyed receipts are editable by an attacker who can recompute a hash. Similarity is a heuristic with no calibrated efficacy study. Indexed transaction/event scans exclude internal transfers and are not block-pinned snapshots. Configured seven-chain support is not seven-chain live verification. Only direct canonical USDC is supported. Source verification is not an audit. Shared quotas, executed-volume accounting, authenticated receipts and real-wallet enforcement are not claimed.
