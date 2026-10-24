# Architecture

`unsigned candidate → protected/public Express route → exact native/USDC normalization → shared evaluation request budget → Blockscout recipient/history/contract data → strongest-match + contract + policy checks → versioned decision/receipt → independent agent binding/freshness/authorization → isolated signer interface`.

The service never signs or broadcasts. The public route only accepts Ethereum; the protected route requires its service key in every environment. All provider requests share bounded time/call/response/spacing limits, and engine errors or client disconnects cancel remaining work. Missing critical data blocks; partial valid history requires review.

The live UI presents effective recipient, raw amount and explicit scan coverage. Existing static recorded-live replay reads only its archive and does not call an evaluator. Research replay is conditional and separate. Simulations use fixtures through the real engine. The SVG graph draws only retained relationships and distinguishes proposed unsigned payments from events.

Receipts use canonical unkeyed SHA-256 and bind payment/agent/policy/check/coverage fields. This is consistency evidence, not authenticated authorization. The server-side agent adapter requires trusted transport, matching immutable candidate, fresh consistent PASS and separate downstream authorization before its isolated signer interface. Mock tests establish enforcement, not a real-wallet integration. Wallet nonce/gas/idempotency checks remain downstream.

Hourly executed-spend accounting, digital receipt signatures and distributed quotas are unsupported. No unsigned evaluation is counted as spending. A shared quota must coordinate the provider key before scaled deployment. See the final matrix and migration review for the release gates.
