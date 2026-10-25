# Short Craftora copy

**Use after the Sprint 2 upgrade is deployed.**

**ScoutGuard PRO — before your AI agent pays, check the chain.** ScoutGuard evaluates an unsigned Ethereum ETH or canonical USDC payment before a signing agent acts. It retrieves Blockscout PRO recipient metadata, activity counters, bounded sender transaction and ERC-20 history, and relevant contract source data. It then checks observed counterparties for look-alike addresses, inspects threat and verification signals, applies asset-specific spending limits, and returns `PASS`, `FLAG`, or `BLOCK`.

The public [dashboard](https://scoutguard.vercel.app/) lets judges run real, rate-limited checks without a service key. The Sprint 2 evidence inspector shows actual upstream request statuses, historical relationship records, individual checks, Explorer links, scan limits, and a downloadable sanitized receipt. Recorded live evaluations replay without new provider requests; fixture attacks are labeled simulations.

On 25 October 2026, proposed 0.1 ETH and 250 USDC samples returned `FLAG` because 300 inspected rows reached the history page cap. A proposed 3,000 USDC sample returned `BLOCK` under the 2,500 USDC cap. The payments were not sent. A separate upgraded local check captured eight successful Blockscout PRO HTTP responses. The historical [token-transfer transaction](https://eth.blockscout.com/tx/0x72b14bf09379c0de3c621035fe341a5ae9726c0dd5732ea3e2096c8e232eee9f) supports an observed counterparty relationship; it is not a ScoutGuard payment.

ScoutGuard fails closed when required data is unavailable. Its mock agent adapter demonstrates exact transaction binding and separate authorization, but no real wallet is connected. History is bounded and receipts use an unkeyed consistency digest, not an authenticated provider signature. [Source and verification](https://github.com/0xNexuz/scoutguard-pro).
