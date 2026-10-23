# Recorded poisoning case replay — 2026-10-23

## Sources and observed event

- Research source: [Poison-Hunter sample dataset](https://github.com/DS2L/Poison-Hunter/blob/main/phishing_transfers_sample.csv), accompanying the ACM CCS 2024 paper. The sampled row identifies attacker `0xcb9d34bbb0480e714f4c004cfd8cb72b776db1b6`, victim `0x3e14605bf3ebc239a6ba1fdd4cd9daf01f382faf`, reference address `0xcb9da91c741820157e81ae21cddd5d207997b1b6`, and poisoning transaction `0xd599a08dc631fbae475bf9ba90f93d5ed075a896336a23027fc321f589d9de1b`.
- Independent on-chain check: Blockscout PRO `GET /1/api/v2/transactions/{hash}` returned HTTP 200, `status: ok`, with a USDT transfer event from the attacker to the victim. [Inspect that transaction in Blockscout Explorer](https://eth.blockscout.com/tx/0xd599a08dc631fbae475bf9ba90f93d5ed075a896336a23027fc321f589d9de1b).
- The source dataset identifies the reference that the attacker address resembles. ScoutGuard's detector found 4 matching leading and 4 matching trailing hexadecimal characters and classified the difference as `CRITICAL`. In the recorded replay, this maps to `BLOCK` for a hypothetical payment to the attacker when the research reference is supplied.

## Important boundary

This case demonstrates a documented poisoning transfer and ScoutGuard's *conditional* pre-signing rule. It does not show that the victim later paid the attacker, that ScoutGuard was running during the historical event, or that ScoutGuard prevented an actual loss.

The current live evaluator fetches only the most recent Blockscout history page for each endpoint. When evaluated live with this victim and attacker, it did not recover the older research reference. That live evaluation returned `BLOCK` due to zero-history and unverified-contract warnings combining to risk 60+, **not** due to the look-alike check. The dashboard therefore labels the historical example `RECORDED RESEARCH REPLAY`, separates it from the live checker, and states the coverage limit in the result.

On the local production-mode server, `GET /api/research-case/poisoning` returned `RECORDED_RESEARCH_REPLAY`, `BLOCK`, and a 4+4 match. The dashboard replay button rendered those fields, the exact transaction and research links, and the coverage limitation. The build and 21 tests passed after adding the sourced regression case.

The separately documented sample transfer [0x72b14b…eee9f](https://eth.blockscout.com/tx/0x72b14bf09379c0de3c621035fe341a5ae9726c0dd5732ea3e2096c8e232eee9f) came from the Blockscout PRO sender token-transfer response and was cross-checked with the transaction detail endpoint. Its `token_transfers` event goes from the sample sender to the sample recipient. The top-level transaction initiator is a different address. It is evidence of historical token transfer activity, not of a ScoutGuard payment.
