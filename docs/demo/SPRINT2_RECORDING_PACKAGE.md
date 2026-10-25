# Sprint 2 recording package · target 110 seconds

The user will record and edit the video. No new Sprint 2 video is asserted to exist. Record the released application; do not film a local fixture result as a live PRO success. Capture one genuine public check, then use saved replay for repeat takes without additional provider credits. Keep browser developer tools, API keys and `.env` off screen.

## Timestamped storyboard and exact voiceover

| Time | Screen and navigation | Voiceover | On-screen caption |
| --- | --- | --- | --- |
| 0–12s | Homepage headline, live CTA. | “An autonomous payment agent can copy a poisoned address and sign before a person notices. ScoutGuard checks the proposed payment first.” | `Before the agent signs` |
| 12–25s | Click **Run Live Blockscout Check**; show the unsigned ETH candidate. | “The agent sends the exact unsigned transaction. ScoutGuard reads Blockscout context for the effective recipient and the sender’s payment history.” | `Unsigned candidate · Ethereum` |
| 25–48s | Run one genuine live check. Pan across source, HTTP statuses, row counts and timestamp. | “This is a fresh Blockscout PRO evaluation. The trace shows the actual recipient and history requests, their statuses, and how many records came back. A browser response alone would not prove those upstream requests worked.” | `Live PRO requests · inspect the trace` |
| 48–66s | Open an observed outgoing node, then its Explorer transaction. | “ScoutGuard separates observed outgoing peers from incoming-only noise. This Explorer transaction contains a historical token-transfer event involving the sample addresses. It is not the proposed payment.” | `Historical event ≠ proposed payment` |
| 66–81s | Show the three evidence layers and the `FLAG` coverage note. | “The intelligence layer compares the recipient with observed references. The policy layer then decides. Here, the scan reached its page limit, so ScoutGuard asks for review rather than claiming a clean pass.” | `Incomplete history → FLAG` |
| 81–99s | Use the 3,000 USDC cap preset if the live provider responds; otherwise open the recorded `usdc-policy-block` case. Show `SEC-POLICY-CAP`, then `npm run demo:agent` captured separately. | “For USDC, ScoutGuard decodes the real beneficiary and checks the canonical contract. Three thousand USDC exceeds this agent’s 2,500 USDC cap. The mock agent refuses to sign a blocked candidate.” | `USDC policy block · mock signer withheld` |
| 99–110s | Recorded replay badge, then dashboard URL and repo. | “Judges can replay saved real evaluations without another API call, inspect every source link, and run their own public check. ScoutGuard turns Blockscout data into a pre-signing control.” | `scoutguard.vercel.app · github.com/0xNexuz/scoutguard-pro` |

The script is roughly 230 words. Speak at about 125–135 words per minute and leave brief pauses for the visible trace and Explorer link. If the live request fails, show the `BLOCK` and sanitized provider error honestly, then cut to the labeled recorded replay. Do not narrate a timeout as successful PRO retrieval.

## Shot list

1. Homepage and the live-first navigation at 1280px.
2. Preset selector, sender, recipient, asset and value before submission.
3. Live result badge, evaluation time, actual per-request statuses, page counts and coverage warning.
4. Selected outgoing relationship node with full address and historical event link.
5. [Blockscout historical transfer](https://eth.blockscout.com/tx/0x72b14bf09379c0de3c621035fe341a5ae9726c0dd5732ea3e2096c8e232eee9f); optionally [sample sender](https://eth.blockscout.com/address/0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be) and [canonical USDC](https://eth.blockscout.com/address/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48).
6. Three separate layers, score contributions and final verdict.
7. Cap-block outcome and the network-free mock-agent terminal output.
8. Recorded replay badge and playback controls, then closing URL/repo.

## Screenshot choices

- [Editorial homepage](../images/sprint2-home.png) after the final browser capture.
- [Actual provider timeout inspector](../images/live-provider-timeout-1280.png) when explaining fail-closed behavior. It is a failed live lookup, not the success screenshot.
- [Recorded live investigation graph](../images/recorded-replay.png), clearly captioned as replayed.
- Capture a **new success inspector screenshot** only during a fresh successful live evaluation; never relabel the timeout screenshot or a fixture browser result.

## Verification before export

- Confirm the recorded dashboard shows the new inspector on the released URL.
- Show the live badge, successful provider statuses and timestamp in the same take as the live verdict, or disclose a failed lookup.
- Follow an Explorer transaction that actually appears in the evaluation evidence; do not use an unrelated example link.
- Keep `LIVE`, `RECORDED_LIVE_EVALUATION`, `RECORDED_RESEARCH_REPLAY` and `SIMULATED` labels legible.
- Never say the Poison-Hunter victim was protected by ScoutGuard. The published reference was supplied conditionally and the current bounded live scan did not recover it.
- Verify the proposed ETH/USDC payments were not broadcast, the mock signer is synthetic, and the unkeyed digest is not a provider signature.
- Check captions at phone size, remove credentials/account details, verify URL/repo spelling, and export a 100–120s final file yourself.
