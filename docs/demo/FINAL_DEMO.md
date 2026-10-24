# ScoutGuard PRO — 100-second demonstration

The recording script uses the actual local application, unchanged saved evaluations and labeled simulations. It never submits the live form, calls Blockscout, signs or broadcasts. Narration below is ready to record separately; the generated local MP4 has captions and no audio. It must be described as a local walkthrough of recorded evidence, not fresh production/live verification.

| Time | Shot and action | Narration |
|---|---|---|
| 0–7s | Landing page and original artwork | “ScoutGuard checks an autonomous agent's payment before signing, using the exact candidate, Blockscout evidence and deterministic policy.” |
| 7–16s | Live evaluation form; do not submit in restricted cloud | “The public form accepts Ethereum ETH or canonical USDC. Fresh provider verification is blocked in this cloud, so this walkthrough uses the clearly labeled recorded cases.” |
| 16–23s | Three-case archive | “These three partial records preserve earlier production checks. They are distinct from a current live approval and from fixture simulations.” |
| 23–31s | Select recorded 250-USDC case; stage 1 candidate | “The transaction targets canonical USDC. ScoutGuard evaluates the decoded beneficiary and exact six-decimal amount.” |
| 31–40s | Stage 2 retained Blockscout evidence | “The retained event links these addresses. Original receipt IDs and exact API times were not saved, and the replay says so.” |
| 40–50s | Stage 3 SVG graph | “Only two supported addresses appear. Solid evidence and the dashed proposed payment are separate. No extra attack network is invented.” |
| 50–60s | Select observed edge and its transaction link | “The event sender differs from the transaction initiator. This supports an observed relationship, not proof that ScoutGuard sent a payment.” |
| 60–68s | Select recipient; keyboard/node details | “An observed counterparty is not automatically trusted. Selecting a node shows only the retained evidence.” |
| 68–79s | Choose 3,000-USDC record; stage 4 checks | “The recorded spending-cap case adds seventy-five risk points because it exceeds the agent's twenty-five-hundred-USDC cap.” |
| 79–86s | Stage 5 BLOCK outcome | “That candidate was blocked. A historical verdict is not a current authorization, and ScoutGuard did not prevent a historical attack here.” |
| 86–92s | Download sanitized receipt excerpt | “The excerpt preserves partial provenance. Its SHA-256 digest is unkeyed, not an authenticated signature.” |
| 92–98s | Address-poisoning SIMULATED scenario | “Attack simulations are separately labeled. Current checks fail closed on missing evidence, and incomplete scans require review.” |
| 98–100s | Agent integration section | “The isolated mock-agent harness proves BLOCK and FLAG never sign.” |

## Recording and verification

Requires Node 22+, `npm ci`, `npm run build`, existing Chromium and ffmpeg. Set `CHROMIUM_PATH` if auto-detection fails, then run `npm run record:demo`. Outputs default to ignored `work/demo-recording/`; `SCOUTGUARD_DEMO_OUTPUT` can choose another authorized local destination. The script captures real browser frames, encodes an actual 100-second MP4 and downloads the partial excerpt. It records no live evaluation. Confirm `recording.json`, ffprobe duration and captions before sharing. Publishing is not authorized.

For an allowed live-verification session, use a separate short take with at most the three public candidate checks and a separately defined history budget. Show the actual verdict/coverage, even if it FLAGs or BLOCKs; never replace failure with a saved PASS. Do not display secrets, request headers or wallet/private-key screens.

## Supporting assets

- Original artwork/logo/favicon remain in `public/assets/`.
- Original archive remains `public/replay/records.json` with three cases.
- Recorder emits captions, downloaded excerpt and metadata; full browser suite emits desktop/mobile screenshots and JSON evidence under `work/browser/`.
- Read the judge walkthrough and submission checklist beside this script.
