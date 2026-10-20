# Architecture

`agent → POST /api/evaluate → ScoutGuard → Blockscout counters + address metadata → conditional contract metadata → poisoning/contract/policy checks → decision + local digest → agent`.

The demo endpoint uses fixture data with the same engine and returns `mode: SIMULATED`. The live endpoint uses a Blockscout PRO gateway when `BLOCKSCOUT_API_KEY` is configured and public explorer endpoints otherwise. An outage produces a `BLOCK` result. The service never touches a private key or broadcasts a transaction.

Trust boundaries: callers supply candidate transaction fields; the server validates addresses, chain, and amount. Blockscout is external and may fail or return incomplete metadata. The caller is responsible for matching the evaluated transaction to the one it signs. The service key protects the live endpoint in production; a reverse proxy and shared rate limiter are needed for a scaled service.
