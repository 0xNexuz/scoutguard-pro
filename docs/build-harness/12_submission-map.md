# Submission map

Official source: [Craftora Blockscout PRO API Buildathon](https://www.craftora.tech/sprints/blockscout-pro-api-buildathon/), checked 2026-10-20. The brief was last checked October 20: it listed Sprint 1 as Oct 8–21, 2026 and Sprint 2 as Oct 25–31. These are recorded dates, not a fresh eligibility/deadline check. Squad size is 1–4. The official page describes the $1,200 prize as **PRO API credits**, despite an inconsistent page badge saying USDC. Exact cutoff time and timezone are not shown in the accessible brief, so reconfirm the active round and deadline before submission.

| Criterion | Weight | Current evidence |
|---|---:|---|
| Blockscout integration | 30% | Authenticated Ethereum PRO proof verified locally and on the public deployment; user demo recording pending |
| Real-world utility | 20% | Clear use case; user validation missing |
| Technical execution | 20% | Original Ethereum deployment evidence plus current hardening build and 106 local tests; new branch not deployed |
| Creativity | 15% | Policy composition; differentiation unverified |
| UX and demo | 10% | Public dashboard interaction verified; user recording pending |
| Blockscout showcase | 5% | Public live API flow verified; user showcase pending |

Sprint 1 asks for a working MVP, public repository, product/write-up, and short demo. Final sprint asks for final product, demo, and X showcase post tagging Blockscout and Craftora with a visual and live-demo or GitHub link. The submission form may demand more fields; inspect it before submission.

| Requirement | Status | Next action |
|---|---|---|
| Public GitHub repository | Original Sprint 2 application released at `aa490c5`; release record `2559de7`. Hardening branch remains local | Use https://github.com/0xNexuz/scoutguard-pro |
| Authenticated PRO API proof | VERIFIED locally on Ethereum | Include redacted live check in the demo; Base needs a paid plan |
| Live product URL | VERIFIED at https://scoutguard.vercel.app/ | Health, simulation, auth, and live Ethereum evaluation passed |
| Short demo | NOT PRODUCED | Record real and simulated flows distinctly |
| Stage write-up | DRAFT below | Align with final verified evidence |
| Craftora squad/project submission | NOT DONE | Builder submits before round closes |
| X showcase post | Final round requirement; NOT DONE | Builder decides whether to publish in Sprint 2 |

Draft one-line description: “ScoutGuard PRO checks Blockscout address and contract data against agent payment policy before signing, and blocks when required data is unavailable.”

Draft stage write-up: “ScoutGuard PRO checks the exact unsigned ETH or canonical direct-USDC payment before signing. Blockscout recipient data, contract metadata and sender-history relationships feed deterministic similarity and spending checks. The original Sprint 2 application was production-verified October 23. A dedicated backend-hardening branch adds bounded history pagination, explicit incomplete-history review, strongest-match selection, provider budgets, public abuse controls and independently reproducible receipt digests. Its local suite passes 106 tests. Fresh live and anonymous production verification of this branch is blocked by cloud network restrictions, and it has not been deployed. Simulations and the sourced research replay are labeled separately. The digest is unkeyed, and a real signer must enforce exact transaction binding. The builder retains publication and video.”

Use the single current [judge-feedback checklist](../SPRINT2_JUDGE_CHECKLIST.md), [implementation status](../SPRINT2_IMPLEMENTATION_STATUS.md) and [Craftora draft](../CRAFTORA_SPRINT2_PROJECT_PAGE.md). Preserve original production evidence and do not present local fixture verification as a fresh live release. Shared quotas, a real signing-agent integration, hourly accounting, user validation, a demo and authorized publication remain open. No official score or 95% completeness claim is made.
