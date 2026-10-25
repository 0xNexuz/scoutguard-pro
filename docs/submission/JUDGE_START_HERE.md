# ScoutGuard judge quickstart · 60–90 seconds

**Use after this branch is released.** The public form needs no private key, signs nothing, and makes fresh Blockscout requests. The result can be `FLAG` or `BLOCK` when data is incomplete; those are valid conservative outcomes.

| Time | Action | What to verify |
| --- | --- | --- |
| 0–10s | Open [ScoutGuard](https://scoutguard.vercel.app/) and choose **Run Live Blockscout Check**. | The product checks an unsigned payment before a signer acts. |
| 10–30s | Select **Observed recipient · ETH**, then run the check. | The live badge, timestamp and sanitized endpoint trace show actual provider outcomes. A `PAGE_LIMIT` should lead to `FLAG`, never an automatic `PASS`. |
| 30–45s | In **Blockscout Intelligence**, inspect the recipient counters, scan coverage and an observed outgoing node. | Open its [historical token-transfer transaction](https://eth.blockscout.com/tx/0x72b14bf09379c0de3c621035fe341a5ae9726c0dd5732ea3e2096c8e232eee9f). This is past chain activity, not the proposed payment. |
| 45–60s | Select **USDC cap · block** and run it. | Canonical USDC is decoded to the beneficiary. The 3,000 USDC candidate is blocked by the 2,500 USDC per-payment policy; do not call that an on-chain attack finding. |
| 60–75s | Choose **Watch an Investigation** and play a recorded live case. | Pause, inspect five stages and the evidence graph. Playback makes no Blockscout request. |
| 75–90s | Open the [technical evidence matrix](JUDGING_EVIDENCE.md). | Check the exact genuine-provider evidence and honest limits. |

If a provider request times out or rate limits, ScoutGuard withholds automatic approval. Open the **recorded live** path for a no-credit walkthrough; its badge never claims to be fresh. The five fixture attack examples are separately marked **SIMULATED**. [Source and tests](https://github.com/0xNexuz/scoutguard-pro).
