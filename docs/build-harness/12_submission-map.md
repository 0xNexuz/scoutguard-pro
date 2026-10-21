# Submission map

Official source: [Craftora Blockscout PRO API Buildathon](https://www.craftora.tech/sprints/blockscout-pro-api-buildathon/), checked 2026-10-20. Current round is **Sprint 1**, Oct 8–21, 2026; Sprint 2 runs Oct 25–31. Squad size is 1–4. The official page describes the $1,200 prize as **PRO API credits**, despite an inconsistent page badge saying USDC. Exact cutoff time and timezone are not shown in the accessible brief, so submit well before Oct 21 ends.

| Criterion | Weight | Current evidence |
|---|---:|---|
| Blockscout integration | 30% | Authenticated Ethereum PRO proof verified locally and on the public deployment; user demo recording pending |
| Real-world utility | 20% | Clear use case; user validation missing |
| Technical execution | 20% | Local build, 17 tests, and deployed Ethereum live check pass |
| Creativity | 15% | Policy composition; differentiation unverified |
| UX and demo | 10% | Public dashboard interaction verified; user recording pending |
| Blockscout showcase | 5% | Public live API flow verified; user showcase pending |

Sprint 1 asks for a working MVP, public repository, product/write-up, and short demo. Final sprint asks for final product, demo, and X showcase post tagging Blockscout and Craftora with a visual and live-demo or GitHub link. The submission form may demand more fields; inspect it before submission.

| Requirement | Status | Next action |
|---|---|---|
| Public GitHub repository | Final application version pushed at `f033f3c`; deployment record at `8d4a1cd` | Use https://github.com/0xNexuz/scoutguard-pro |
| Authenticated PRO API proof | VERIFIED locally on Ethereum | Include redacted live check in the demo; Base needs a paid plan |
| Live product URL | VERIFIED at https://scoutguard.vercel.app/ | Health, simulation, auth, and live Ethereum evaluation passed |
| Short demo | NOT PRODUCED | Record real and simulated flows distinctly |
| Stage write-up | DRAFT below | Align with final verified evidence |
| Craftora squad/project submission | NOT DONE | Builder submits before round closes |
| X showcase post | Final round requirement; NOT DONE | Builder decides whether to publish in Sprint 2 |

Draft one-line description: “ScoutGuard PRO checks Blockscout address and contract data against agent payment policy before signing, and blocks when required data is unavailable.”

Draft stage write-up: “We built a pre-signing EVM payment risk API and interactive dashboard. It combines Blockscout address counters, address metadata, contract verification metadata, a known-counterparty similarity check, and spending limits into a tri-state decision. Five labeled fixture scenarios demonstrate the policy engine. Seventeen local tests cover vanity collision, policy caps, fail-closed behavior, and the PRO gateway URL. An authenticated Blockscout PRO evaluation on Ethereum passed on the public deployment. The dashboard is live at https://scoutguard.vercel.app/. The demo recording is being prepared by the builder.”
